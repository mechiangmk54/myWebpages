function parseLinear(eq) {
    eq = eq.replace(/\s+/g, '');
    let operator = '=';
    let parts;
    if (eq.includes('<=')) { operator = '<='; parts = eq.split('<='); }
    else if (eq.includes('>=')) { operator = '>='; parts = eq.split('>='); }
    else if (eq.includes('<')) { operator = '<'; parts = eq.split('<'); }
    else if (eq.includes('>')) { operator = '>'; parts = eq.split('>'); }
    else { parts = eq.split('='); }

    let A = 0, B = 0, C = 0;

    function parseSide(sideStr, signMultiplier) {
        if (!sideStr) return;
        const regex = /([+-]?\d*\.?\d*)([xy]?)/gi;
        let match;
        while ((match = regex.exec(sideStr)) !== null) {
            if (match[0] === '') {
                regex.lastIndex++;
                continue;
            }
            let coeffStr = match[1];
            let varName = match[2].toLowerCase();

            if (coeffStr === '+' || coeffStr === '-' || coeffStr === '') {
                coeffStr += '1';
            }

            let val = parseFloat(coeffStr) * signMultiplier;
            if (varName === 'x') A += val;
            else if (varName === 'y') B += val;
            else C += val;
        }
    }
    parseSide(parts[0], 1);
    if (parts.length > 1) {
        parseSide(parts[1], -1);
    }
    return { A, B, C, op: operator }; // Ax + By + C (op) 0
}

function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toFraction(val, tolerance = 1e-5) {
    if (Math.abs(val - Math.round(val)) < tolerance) return Math.round(val).toString();

    let sign = val < 0 ? -1 : 1;
    val = Math.abs(val);

    let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
    let b = val;
    do {
        let a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        b = 1 / (b - a);
    } while (Math.abs(val - h1 / k1) > val * tolerance && k1 < 1000);

    if (k1 > 1000) return (sign * val).toFixed(2);
    if (k1 === 1) return (sign * h1).toString();
    return (sign * h1) + '/' + k1;
}

function getShadedPolygon(minX, maxX, minY, maxY, A, B, C, op) {
    function evalF(x, y) { return A * x + B * y + C; }
    function isValid(val) {
        // Since we parsed terms onto the left side, the expression is: f(x) (op) 0
        if (op === '<' || op === '<=') return val <= 1e-10;
        if (op === '>' || op === '>=') return val >= -1e-10;
        return false;
    }

    const corners = [
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
        { x: maxX, y: minY },
        { x: minX, y: minY }
    ];

    let points = [];
    corners.forEach(c => {
        if (isValid(evalF(c.x, c.y))) points.push(c);
    });

    if (Math.abs(A) > 1e-10) {
        let xTop = -(B * maxY + C) / A;
        if (xTop >= minX && xTop <= maxX) points.push({ x: xTop, y: maxY });
        let xBot = -(B * minY + C) / A;
        if (xBot >= minX && xBot <= maxX) points.push({ x: xBot, y: minY });
    }
    if (Math.abs(B) > 1e-10) {
        let yLeft = -(A * minX + C) / B;
        if (yLeft >= minY && yLeft <= maxY) points.push({ x: minX, y: yLeft });
        let yRight = -(A * maxX + C) / B;
        if (yRight >= minY && yRight <= maxY) points.push({ x: maxX, y: yRight });
    }

    if (points.length < 3) return null;

    points = points.filter((p, index, self) =>
        index === self.findIndex(t => Math.abs(t.x - p.x) < 1e-10 && Math.abs(t.y - p.y) < 1e-10)
    );

    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    points.sort((a, b) => {
        return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
    });

    return points;
}

class GraphViewer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 50;
        this.equations = [];

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.initEvents();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    resetView() {
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 50;
        this.draw();
    }

    zoom(zoomFactor, e) {
        let mathX0, mathY0;

        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            mathX0 = this.screenWidthToMathX(mouseX);
            mathY0 = this.screenHeightToMathY(mouseY);
        } else {
            mathX0 = this.screenWidthToMathX(this.canvas.width / 2);
            mathY0 = this.screenHeightToMathY(this.canvas.height / 2);
        }

        this.scale *= zoomFactor;

        if (e) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const mathX1 = this.screenWidthToMathX(mouseX);
            const mathY1 = this.screenHeightToMathY(mouseY);
            this.offsetX += (mathX0 - mathX1);
            this.offsetY += (mathY0 - mathY1);
        }

        this.draw();
    }

    initEvents() {
        this.canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;

            this.offsetX -= dx / this.scale;
            this.offsetY += dy / this.scale;

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.draw();
        });

        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e);
        });
    }

    screenWidthToMathX(sx) { return (sx - this.canvas.width / 2) / this.scale + this.offsetX; }
    screenHeightToMathY(sy) { return (this.canvas.height / 2 - sy) / this.scale + this.offsetY; }
    mathXToScreenWidth(mx) { return (mx - this.offsetX) * this.scale + this.canvas.width / 2; }
    mathYToScreenHeight(my) { return this.canvas.height / 2 - (my - this.offsetY) * this.scale; }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const idealStep = 80 / this.scale;
        const exponent = Math.floor(Math.log10(idealStep));
        const fraction = idealStep / Math.pow(10, exponent);

        let niceFraction;
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 4) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;

        const step = niceFraction * Math.pow(10, exponent);

        const minMathX = this.screenWidthToMathX(0);
        const maxMathX = this.screenWidthToMathX(w);
        const minMathY = this.screenHeightToMathY(h);
        const maxMathY = this.screenHeightToMathY(0);

        ctx.font = '12px Inter';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const startX = Math.floor(minMathX / step) * step;
        for (let x = startX; x <= maxMathX; x += step) {
            const sx = this.mathXToScreenWidth(x);
            ctx.strokeStyle = Math.abs(x) < 1e-10 ? '#cbd5e1' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = Math.abs(x) < 1e-10 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, h);
            ctx.stroke();

            if (Math.abs(x) > 1e-10) {
                const sy = Math.max(0, Math.min(this.mathYToScreenHeight(0), h - 20));
                ctx.fillText(parseFloat(x.toPrecision(4)), sx, sy + 5);
            }
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const startY = Math.floor(minMathY / step) * step;
        for (let y = startY; y <= maxMathY; y += step) {
            const sy = this.mathYToScreenHeight(y);
            ctx.strokeStyle = Math.abs(y) < 1e-10 ? '#cbd5e1' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = Math.abs(y) < 1e-10 ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(0, sy);
            ctx.lineTo(w, sy);
            ctx.stroke();

            if (Math.abs(y) > 1e-10) {
                const originX = this.mathXToScreenWidth(0);
                const sx = Math.max(20, Math.min(originX, w));
                if (originX < 0) {
                    ctx.textAlign = 'left';
                    ctx.fillText(parseFloat(y.toPrecision(4)), 5, sy);
                } else if (originX > w) {
                    ctx.textAlign = 'right';
                    ctx.fillText(parseFloat(y.toPrecision(4)), w - 5, sy);
                } else {
                    ctx.textAlign = 'right';
                    ctx.fillText(parseFloat(y.toPrecision(4)), originX - 5, sy);
                }
            }
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('0', Math.max(5, Math.min(this.mathXToScreenWidth(0) - 5, w - 5)), Math.max(5, Math.min(this.mathYToScreenHeight(0) + 5, h - 20)));

        // Draw shaded regions for inequalities
        this.equations.forEach(eq => {
            if (eq.obj.op !== '=') {
                const poly = getShadedPolygon(minMathX, maxMathX, minMathY, maxMathY, eq.obj.A, eq.obj.B, eq.obj.C, eq.obj.op);
                if (poly && poly.length > 2) {
                    ctx.fillStyle = hexToRgba(eq.color, 0.15); // Semi-transparent overlay
                    ctx.beginPath();
                    poly.forEach((p, idx) => {
                        const px = this.mathXToScreenWidth(p.x);
                        const py = this.mathYToScreenHeight(p.y);
                        if (idx === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    });
                    ctx.closePath();
                    ctx.fill();
                }
            }
        });

        // Draw exact lines
        ctx.lineWidth = 2;
        this.equations.forEach(eq => {
            const { A, B, C, op } = eq.obj;
            // Draw dashed line if strictly less or strictly greater
            if (op === '<' || op === '>') {
                ctx.setLineDash([8, 6]); // Dashed
            } else {
                ctx.setLineDash([]); // Solid
            }

            ctx.strokeStyle = eq.color;
            ctx.beginPath();

            if (Math.abs(B) < 1e-10) {
                if (Math.abs(A) > 1e-10) {
                    const x = -C / A;
                    const sx = this.mathXToScreenWidth(x);
                    ctx.moveTo(sx, 0);
                    ctx.lineTo(sx, h);
                }
            } else {
                const y0 = (-A * minMathX - C) / B;
                const y1 = (-A * maxMathX - C) / B;
                ctx.moveTo(0, this.mathYToScreenHeight(y0));
                ctx.lineTo(w, this.mathYToScreenHeight(y1));
            }
            ctx.stroke();
            ctx.setLineDash([]); // reset immediately just in case
        });

        // Compute and draw intersections
        let intersections = [];
        for (let i = 0; i < this.equations.length; i++) {
            for (let j = i + 1; j < this.equations.length; j++) {
                let eq1 = this.equations[i].obj;
                let eq2 = this.equations[j].obj;

                // Determinant of Cramer's rule: A1 x + B1 y = -C1, A2 x + B2 y = -C2
                // Det = A1*B2 - A2*B1
                let det = eq1.A * eq2.B - eq2.A * eq1.B;
                if (Math.abs(det) > 1e-10) {
                    let x = (eq1.B * eq2.C - eq2.B * eq1.C) / det;
                    let y = (eq1.C * eq2.A - eq2.C * eq1.A) / det;

                    // Keep track of which equations formulated this intersect to color code? Using primary colors.
                    intersections.push({ x, y });
                }
            }
        }

        // Remove duplicate close intersections if multiple lines hit the same spot
        intersections = intersections.filter((p, index, self) =>
            index === self.findIndex(t => Math.abs(t.x - p.x) < 1e-6 && Math.abs(t.y - p.y) < 1e-6)
        );

        // Draw intersection markers
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.font = '13px Inter';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        intersections.forEach(p => {
            let sx = this.mathXToScreenWidth(p.x);
            let sy = this.mathYToScreenHeight(p.y);
            if (sx >= -10 && sx <= w + 10 && sy >= -10 && sy <= h + 10) {
                // Dot
                ctx.beginPath();
                ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Coordinates Text Box for better readability
                const text = `(${toFraction(p.x)}, ${toFraction(p.y)})`;
                const textWidth = ctx.measureText(text).width;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // Dark backdrop
                ctx.fillRect(sx + 8, sy - 28, textWidth + 8, 20); // x, y, width, height
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(text, sx + 12, sy - 12); // Slightly offset from dot
                ctx.fillStyle = '#f8fafc'; // Reset dot fill color for next iteration
            }
        });
    }

    addEquation(eqStr) {
        try {
            const parsed = parseLinear(eqStr);
            if (Math.abs(parsed.A) < 1e-10 && Math.abs(parsed.B) < 1e-10) {
                throw new Error("Invalid Equation");
            }
            const colors = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
            const color = colors[this.equations.length % colors.length];
            const eqData = { id: Date.now(), obj: parsed, str: eqStr, color: color };
            this.equations.push(eqData);
            this.draw();
            return eqData;
        } catch (e) {
            alert('解析方程式時發生錯誤，請確認格式（例如：2x+3y <= 6）');
            return null;
        }
    }

    removeEquation(id) {
        this.equations = this.equations.filter(eq => eq.id !== id);
        this.draw();
    }
}

class ProportionsViewer {
    constructor(canvasId, type) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.type = type; // 'direct' or 'inverse'
        this.dataPoints = [];

        // Settings based on type
        if (this.type === 'direct') {
            this.minX = 0; this.maxX = 12;
            this.minY = 0; this.maxY = 120;
        } else {
            this.minX = 0; this.maxX = 35;
            this.minY = 0; this.maxY = 35;
        }

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.draw();
    }

    setData(points) {
        this.dataPoints = points;
        this.draw();
    }

    mXtoS(x) {
        const pad = 30;
        const w = this.canvas.width - pad * 2;
        return pad + (x / this.maxX) * w;
    }

    mYtoS(y) {
        const pad = 30;
        const h = this.canvas.height - pad * 2;
        return this.canvas.height - pad - (y / this.maxY) * h;
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);

        const pad = 30;

        // Draw Axes & Labels
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad, pad); // Y axis top
        ctx.lineTo(pad, h - pad); // Y axis bot
        ctx.lineTo(w - pad, h - pad); // X axis right
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('0', pad - 10, h - pad + 5);

        // Draw Math Curve
        ctx.strokeStyle = this.type === 'direct' ? '#3b82f6' : '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.type === 'direct') {
            ctx.moveTo(this.mXtoS(0), this.mYtoS(0));
            ctx.lineTo(this.mXtoS(this.maxX), this.mYtoS(this.maxX * 10));
        } else {
            let first = true;
            for (let x = 0.5; x <= this.maxX; x += 0.5) {
                let y = 120 / x;
                if (y <= this.maxY + 10) {
                    const sx = this.mXtoS(x);
                    const sy = this.mYtoS(y);
                    if (first) { ctx.moveTo(sx, sy); first = false; }
                    else { ctx.lineTo(sx, sy); }
                }
            }
        }
        ctx.stroke();

        // Draw Dots
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        this.dataPoints.forEach(p => {
            if (p.x > 0 && p.x <= this.maxX && p.y > 0 && p.y <= this.maxY) {
                const sx = this.mXtoS(p.x);
                const sy = this.mYtoS(p.y);

                ctx.beginPath();
                ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                const txt = `(${p.x}, ${p.y})`;
                const tw = ctx.measureText(txt).width;
                ctx.fillRect(sx, sy - 25, tw + 10, 20);

                ctx.fillStyle = '#f8fafc';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(txt, sx + 5, sy - 15);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mainMenu = document.getElementById('main-menu');
    const graphToolView = document.getElementById('graph-tool-view');
    const btnGraphing = document.getElementById('btn-graphing');
    const backBtn = document.getElementById('back-btn');

    let graphViewer = null;

    function animateTransition(hideEl, showEl, onComplete) {
        hideEl.classList.remove('fade-in');
        hideEl.classList.add('fade-out');

        setTimeout(() => {
            hideEl.style.display = 'none';
            showEl.style.display = '';
            showEl.classList.remove('fade-out', 'hidden');
            showEl.classList.add('fade-in');
            if (onComplete) onComplete();
        }, 400);
    }

    btnGraphing.addEventListener('click', () => {
        animateTransition(mainMenu, graphToolView, () => {
            if (!graphViewer) {
                graphViewer = new GraphViewer('graph-canvas');
                graphViewer.resize();

                document.getElementById('zoom-in').addEventListener('click', () => graphViewer.zoom(1.2));
                document.getElementById('zoom-out').addEventListener('click', () => graphViewer.zoom(1 / 1.2));
                document.getElementById('reset-view').addEventListener('click', () => graphViewer.resetView());

                const newEqInput = document.getElementById('new-eq-input');
                const addEqBtn = document.getElementById('add-eq-btn');
                const eqList = document.getElementById('eq-list');

                function handleAdd() {
                    const str = newEqInput.value.trim();
                    if (!str) return;
                    const eqData = graphViewer.addEquation(str);
                    if (eqData) {
                        newEqInput.value = '';
                        const li = document.createElement('li');
                        li.className = 'eq-item';
                        li.style.setProperty('--eq-color', eqData.color);
                        li.innerHTML = `
                            <span>${eqData.str}</span>
                            <button class="remove-btn" title="移除">✖</button>
                        `;
                        li.querySelector('.remove-btn').addEventListener('click', () => {
                            graphViewer.removeEquation(eqData.id);
                            li.remove();
                        });
                        eqList.appendChild(li);
                    }
                }

                addEqBtn.addEventListener('click', handleAdd);
                newEqInput.addEventListener('keypress', e => {
                    if (e.key === 'Enter') handleAdd();
                });
            } else {
                graphViewer.resize();
            }
        });
    });

    backBtn.addEventListener('click', () => {
        animateTransition(graphToolView, mainMenu);
    });

    // Proportions Logic Integration
    const btnProportions = document.getElementById('btn-proportions');
    const proportionsToolView = document.getElementById('proportions-tool-view');
    const propBackBtn = document.getElementById('prop-back-btn');

    let propDirectViewer = null;
    let propInverseViewer = null;

    function initProportionsTable(tableId, initialX, type, viewer) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        tbody.innerHTML = '';

        const updateAll = () => {
            const points = [];
            tbody.querySelectorAll('tr').forEach(tr => {
                const input = tr.querySelector('.table-input');
                const yCell = tr.querySelector('.y-val');
                const xyCell = tr.querySelector('.xy-val');
                let x = parseFloat(input.value);
                if (isNaN(x) || x <= 0) {
                    yCell.textContent = '-';
                    if (xyCell) xyCell.textContent = '-';
                } else {
                    let y = type === 'direct' ? x * 10 : 120 / x;
                    y = parseFloat(y.toFixed(2));
                    yCell.textContent = y;
                    if (xyCell) {
                        xyCell.textContent = Math.round(x * (120 / x)); // Should always equate to 120 mathematically
                    }
                    points.push({ x, y });
                }
            });
            viewer.setData(points);
        };

        initialX.forEach(x => {
            const tr = document.createElement('tr');
            if (type === 'inverse') {
                tr.innerHTML = `
                    <td><input type="number" class="table-input" value="${x}" step="any" min="0"></td>
                    <td class="y-val"></td>
                    <td class="xy-val" style="color: #10b981; font-weight: 600;"></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><input type="number" class="table-input" value="${x}" step="any" min="0"></td>
                    <td class="y-val"></td>
                `;
            }
            tr.querySelector('input').addEventListener('input', updateAll);
            tbody.appendChild(tr);
        });

        updateAll();
    }

    btnProportions.addEventListener('click', () => {
        animateTransition(mainMenu, proportionsToolView, () => {
            if (!propDirectViewer) {
                propDirectViewer = new ProportionsViewer('direct-canvas', 'direct');
                propInverseViewer = new ProportionsViewer('inverse-canvas', 'inverse');

                initProportionsTable('direct-table', [1, 2, 3, 5, 10], 'direct', propDirectViewer);
                initProportionsTable('inverse-table', [5, 8, 12, 20, 30], 'inverse', propInverseViewer);
            }
            propDirectViewer.resize();
            propInverseViewer.resize();
        });
    });

    propBackBtn.addEventListener('click', () => {
        animateTransition(proportionsToolView, mainMenu);
    });
});
