document.addEventListener('DOMContentLoaded', () => {
    const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Constraint } = Matter;

    const engine = Engine.create();
    const world = engine.world;
    world.gravity.y = 0.4;

    const canvas = document.getElementById('matter-canvas');
    const sky = document.getElementById('sky');
    const skyBackground = document.getElementById('sky-background');
    const controls = document.getElementById('controls');
    const categorySelect = document.getElementById('category-select');

    const render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: skyBackground.clientWidth,
            height: skyBackground.clientHeight,
            wireframes: false,
            background: 'transparent'
        }
    });

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // --- Create Clouds ---
    function createClouds() {
        const cloudCount = 6;
        for (let i = 0; i < cloudCount; i++) {
            const cloud = document.createElement('div');
            cloud.classList.add('cloud');
            
            const width = 100 + Math.random() * 100;
            const height = width * 0.4;
            const top = Math.random() * 60; // Keep clouds in the upper part
            const left = Math.random() * 100;
            const duration = 20 + Math.random() * 40;
            const delay = -(Math.random() * duration); // Start at random phase

            cloud.style.width = `${width}px`;
            cloud.style.height = `${height}px`;
            cloud.style.top = `${top}%`;
            cloud.style.left = `${left}%`;
            cloud.style.animation = `cloud-drift ${duration}s linear infinite`;
            cloud.style.animationDelay = `${delay}s`;
            cloud.style.opacity = 0.4 + Math.random() * 0.4;

            skyBackground.appendChild(cloud);
        }
    }
    createClouds();

    // --- Collision Filtering Setup ---
    const wallCategory = 0x0001;
    const balloonCategory = 0x0002;
    const tailCategory = 0x0004;

    const wallThickness = 50;
    const wallOptions = {
        isStatic: true,
        render: { visible: false },
        collisionFilter: { category: wallCategory }
    };
    
    // Calculate offset for the top wall to stay below controls
    const getControlOffset = () => controls.offsetTop + controls.offsetHeight + 10;
    let controlOffset = getControlOffset();

    let walls = [
        // Bottom
        Bodies.rectangle(skyBackground.clientWidth / 2, skyBackground.clientHeight + wallThickness / 2, skyBackground.clientWidth, wallThickness, wallOptions),
        // Top (Adjusted for controls)
        Bodies.rectangle(skyBackground.clientWidth / 2, controlOffset - wallThickness / 2, skyBackground.clientWidth, wallThickness, wallOptions),
        // Left
        Bodies.rectangle(-wallThickness / 2, skyBackground.clientHeight / 2, wallThickness, skyBackground.clientHeight, wallOptions),
        // Right
        Bodies.rectangle(skyBackground.clientWidth + wallThickness / 2, skyBackground.clientHeight / 2, wallThickness, skyBackground.clientHeight, wallOptions)
    ];
    World.add(world, walls);

    // --- Handle Resize ---
    window.addEventListener('resize', () => {
        const width = skyBackground.clientWidth;
        const height = skyBackground.clientHeight;
        controlOffset = getControlOffset();

        render.canvas.width = width;
        render.canvas.height = height;
        render.options.width = width;
        render.options.height = height;

        // Update wall positions
        Body.setPosition(walls[0], { x: width / 2, y: height + wallThickness / 2 });
        Body.setPosition(walls[1], { x: width / 2, y: controlOffset - wallThickness / 2 });
        Body.setPosition(walls[2], { x: -wallThickness / 2, y: height / 2 });
        Body.setPosition(walls[3], { x: width + wallThickness / 2, y: height / 2 });
    });

    const addButton = document.getElementById('add-button');
    const todoInput = document.getElementById('todo-input');
    
    let balloons = [];
    let focusedBalloon = null;

    // --- Local Storage Logic ---
    function saveToLocalStorage() {
        const balloonData = balloons.map(b => ({
            text: b.text,
            category: b.category,
            color: b.color,
            size: b.size,
            targetY: b.targetY
        }));
        localStorage.setItem('balloons', JSON.stringify(balloonData));
    }

    function loadFromLocalStorage() {
        const saved = localStorage.getItem('balloons');
        if (saved) {
            const data = JSON.parse(saved);
            data.forEach(item => {
                createBalloon(item.text, item.category, item);
            });
        }
    }

    addButton.addEventListener('click', () => {
        const todoText = todoInput.value.trim();
        const category = categorySelect.value;
        if (todoText) {
            createBalloon(todoText, category);
            todoInput.value = '';
            saveToLocalStorage();
        }
    });

    function createBalloon(text, category, savedData = null) {
        const size = savedData ? savedData.size : (Math.random() * 20 + 30);
        const x = Math.random() * (skyBackground.clientWidth - size * 2) + size;
        const y = skyBackground.clientHeight;

        let balloonColor;
        if (savedData) {
            balloonColor = savedData.color;
        } else {
            if (category === 'work') {
                balloonColor = '#FFEE8C'; // Pastel Yellow
            } else if (category === 'personal') {
                balloonColor = ['#990F02'][Math.floor(Math.random() * 2)]; // Cherry Red
            } else {
                balloonColor = ['#FFB7CE', '#BFFCC6', '#C5B4E3', '#FAD5A5', '#FEFD96'][Math.floor(Math.random() * 5)];
            }
        }

        const balloonBody = Bodies.circle(x, y, size, {
            restitution: 0.6,
            frictionAir: 0.08,
            inertia: Infinity,
            render: { fillStyle: 'transparent' },
            collisionFilter: {
                category: balloonCategory,
                mask: wallCategory | balloonCategory 
            }
        });

        const balloonElement = document.createElement('div');
        balloonElement.classList.add('balloon');
        if (category === 'personal') balloonElement.classList.add('heart');
        if (category === 'work') balloonElement.classList.add('round');

        requestAnimationFrame(() => {
            balloonElement.classList.add('added');
        });
        balloonElement.style.width = `${size * 2}px`;
        balloonElement.style.height = `${size * 2 * (category === 'personal' || category === 'work' ? 1 : 1.2)}px`;
        
        balloonElement.style.background = `radial-gradient(circle at 30% 30%, #ffffff 0%, ${balloonColor} 20%, ${balloonColor} 100%)`;
        balloonElement.style.color = balloonColor;

        const tooltip = document.createElement('div');
        tooltip.classList.add('balloon-tooltip');
        tooltip.textContent = 'Click to view tasks';
        balloonElement.appendChild(tooltip);

        const modal = createModal(text);
        skyBackground.appendChild(modal);
        skyBackground.appendChild(balloonElement);
        
        const tailSegments = 15;
        const segmentSize = 0.5;
        const tailComposite = Composite.create({ label: 'Tail' });
        let previous = balloonBody;

        for (let i = 0; i < tailSegments; i++) {
            const segment = Bodies.circle(x, y + size + (i * 8), segmentSize, {
                frictionAir: 0.12,
                restitution: 0.4,
                render: { visible: false },
                collisionFilter: { mask: 0 }
            });
            Composite.add(tailComposite, segment);

            let constraintOptions = {
                bodyA: previous,
                bodyB: segment,
                stiffness: 0.7,
                length: 8,
                render: { visible: false }
            };
            
            if (i === 0) {
                constraintOptions.pointA = { x: 0, y: size };
            }

            const constraint = Constraint.create(constraintOptions);
            Composite.add(tailComposite, constraint);
            previous = segment;
        }

        let targetY;
        if (savedData) {
            targetY = savedData.targetY;
        } else {
            const minTargetY = controlOffset + size + 20;
            const maxTargetY = skyBackground.clientHeight - size - 50;
            targetY = Math.max(minTargetY, Math.min(maxTargetY, (Math.random() * (maxTargetY - minTargetY) + minTargetY)));
        }

        const balloon = {
            body: balloonBody,
            tail: tailComposite,
            element: balloonElement,
            text: text,
            modal: modal,
            targetY: targetY,
            size: size,
            category: category,
            driftPhase: Math.random() * Math.PI * 2,
            color: balloonColor
        };
        
        balloons.push(balloon);
        World.add(world, [balloon.body, balloon.tail]);

        balloonElement.addEventListener('click', (e) => { e.stopPropagation(); toggleFocus(balloon); });
        modal.querySelector('.close-button').addEventListener('click', (e) => { e.stopPropagation(); toggleFocus(balloon); });
        modal.querySelector('.complete-button').addEventListener('click', (e) => {
            e.stopPropagation();
            const burstX = balloon.body.position.x;
            const burstY = balloon.body.position.y;
            
            balloonElement.classList.add('popping');
            modal.classList.remove('show');
            
            for (let i = 0; i < 20; i++) {
                createConfetti(burstX, burstY, balloon.color);
            }

            const balloonIndex = balloons.findIndex(b => b === balloon);
            if (balloonIndex > -1) {
                World.remove(world, [balloons[balloonIndex].body, balloons[balloonIndex].tail]);
                balloons.splice(balloonIndex, 1);
                saveToLocalStorage();
            }
            balloonElement.addEventListener('animationend', () => {
                balloonElement.remove();
                modal.remove();
                if (focusedBalloon === balloon) { focusedBalloon = null; sky.classList.remove('dimmed'); }
            });
        });
        modal.querySelector('.edit-button').addEventListener('click', (e) => {
            e.stopPropagation();
            const newText = prompt('Edit your todo:', balloon.text);
            if (newText) { 
                balloon.text = newText; 
                modal.querySelector('p').textContent = newText;
                saveToLocalStorage();
            }
        });
    }

    function createConfetti(x, y, color) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.backgroundColor = color;
        confetti.style.left = `${x}px`;
        confetti.style.top = `${y}px`;
        
        const dx = (Math.random() - 0.5) * 200;
        const dy = (Math.random() - 0.5) * 200;
        const dr = Math.random() * 360;
        
        confetti.style.setProperty('--dx', `${dx}px`);
        confetti.style.setProperty('--dy', `${dy}px`);
        confetti.style.setProperty('--dr', `${dr}deg`);
        
        confetti.style.animation = `confetti-fall ${0.5 + Math.random() * 0.5}s ease-out forwards`;
        
        skyBackground.appendChild(confetti);
        confetti.addEventListener('animationend', () => confetti.remove());
    }

    function createModal(text) {
        const modal = document.createElement('div');
        modal.classList.add('balloon-modal');
        modal.innerHTML = `<button class="close-button">&times;</button><p>${text}</p><button class="edit-button">Edit</button><button class="complete-button">Complete</button>`;
        return modal;
    }

    function toggleFocus(balloon) {
        const wasFocused = focusedBalloon === balloon;
        
        if (focusedBalloon) {
            focusedBalloon.element.classList.remove('focus');
            focusedBalloon.modal.classList.remove('show');
            sky.classList.remove('dimmed');
            Body.setStatic(focusedBalloon.body, false);
        }

        focusedBalloon = null;

        if (!wasFocused) {
            focusedBalloon = balloon;
            focusedBalloon.element.classList.add('focus');
            focusedBalloon.modal.classList.add('show');
            sky.classList.add('dimmed');
            
            Body.setStatic(focusedBalloon.body, true);
            Body.setAngle(focusedBalloon.body, 0);

            const modal = balloon.modal;
            const size = balloon.size;
            const modalRect = modal.getBoundingClientRect();
            const balloonX = balloon.body.position.x;
            const balloonY = balloon.body.position.y;

            let modalLeft = balloonX + size + 15;
            let modalTop = balloonY - modalRect.height / 2;

            if (modalLeft + modalRect.width > skyBackground.clientWidth) {
                modalLeft = balloonX - size - modalRect.width - 15;
            }

            if (modalLeft < 0) modalLeft = 10;
            if (modalTop < 0) modalTop = 10;
            if (modalTop + modalRect.height > skyBackground.clientHeight) {
                modalTop = skyBackground.clientHeight - modalRect.height - 10;
            }

            modal.style.top = `${modalTop}px`;
            modal.style.left = `${modalLeft}px`;
        }
    }
    
    sky.addEventListener('click', () => {
        if (focusedBalloon) { toggleFocus(focusedBalloon); }
    });

    Events.on(render, 'afterRender', () => {
        const ctx = render.context;
        ctx.save();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        balloons.forEach(balloon => {
            const segments = balloon.tail.bodies;
            if (segments.length === 0) return;

            ctx.beginPath();
            const angle = balloon.body.angle;
            const visualHeight = balloon.category === 'personal' || balloon.category === 'work' ? balloon.size : balloon.size * 1.2;
            const startX = balloon.body.position.x - visualHeight * Math.sin(angle);
            const startY = balloon.body.position.y + visualHeight * Math.cos(angle);
            
            ctx.moveTo(startX, startY);

            for (let i = 0; i < segments.length; i++) {
                const squiggle = Math.sin(balloon.driftPhase * 3 + i * 0.5) * (i * 0.4);
                ctx.lineTo(segments[i].position.x + squiggle, segments[i].position.y);
            }
            ctx.stroke();
        });
        ctx.restore();
    });

    Events.on(engine, 'beforeUpdate', () => {
        balloons.forEach(balloon => {
            if (!balloon.body) return;
            const { body, element } = balloon;

            if (focusedBalloon !== balloon) {
                balloon.driftPhase += 0.005;
                const driftOffset = Math.sin(balloon.driftPhase) * 50;
                const currentTargetY = balloon.targetY + driftOffset;
                const swayForce = Math.sin(balloon.driftPhase * 1.5) * 0.0004 * body.mass;
                const dy = currentTargetY - body.position.y;
                const verticalForce = dy * 0.00005; 
                const floatingForce = -0.0042 * body.mass;
                const horizontalForce = (Math.random() - 0.5) * 0.0002;

                Body.applyForce(body, body.position, {
                    x: swayForce + horizontalForce,
                    y: floatingForce + verticalForce, 
                });
            }

            const { x, y } = body.position;
            element.style.left = `${x - element.clientWidth / 2}px`;
            element.style.top = `${y - element.clientHeight / 2}px`;
            if (!element.classList.contains('popping')) {
                element.style.transform = `rotate(${body.angle}rad)`;
            }
        });
    });

    // Initialize from local storage
    loadFromLocalStorage();
});
