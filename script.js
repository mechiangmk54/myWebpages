function parseLinear(eq) {
    eq = eq.replace(/\s+/g, '');
    const parts = eq.split('=');
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
    return { A, B, C };
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
                // Align left if origin is off-screen left
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

        ctx.lineWidth = 2;
        this.equations.forEach(eq => {
            ctx.strokeStyle = eq.color;
            ctx.beginPath();
            const { A, B, C } = eq.obj;

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
            alert('解析方程式時發生錯誤，請確認格式（例如：2x+3y=6）');
            return null;
        }
    }

    removeEquation(id) {
        this.equations = this.equations.filter(eq => eq.id !== id);
        this.draw();
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
            showEl.style.display = showEl.id === 'main-menu' ? 'flex' : 'flex';
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

                // Setup Zoom controls
                document.getElementById('zoom-in').addEventListener('click', () => graphViewer.zoom(1.2));
                document.getElementById('zoom-out').addEventListener('click', () => graphViewer.zoom(1 / 1.2));
                document.getElementById('reset-view').addEventListener('click', () => graphViewer.resetView());

                // Setup Input
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
});
