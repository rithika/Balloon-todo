document.addEventListener('DOMContentLoaded', () => {
    const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Constraint } = Matter;

    const engine = Engine.create();
    const world = engine.world;
    world.gravity.y = 0.4;

    const canvas = document.getElementById('matter-canvas');
    const sky = document.getElementById('sky');
    const skyBackground = document.getElementById('sky-background');
    const controls = document.getElementById('controls');

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

    addButton.addEventListener('click', () => {
        const todoText = todoInput.value.trim();
        if (todoText) {
            createBalloon(todoText);
            todoInput.value = '';
        }
    });

    function createBalloon(text) {
        const size = Math.random() * 20 + 30;
        const x = Math.random() * (skyBackground.clientWidth - size * 2) + size;
        const y = skyBackground.clientHeight;

        const balloonColor = ['#FFB7CE', '#BFFCC6', '#C5B4E3', '#FAD5A5'][Math.floor(Math.random() * 4)];

        const balloonBody = Bodies.circle(x, y, size, {
            restitution: 0.6,
            frictionAir: 0.08, // --- Increased friction for milder float ---
            render: { fillStyle: 'transparent' },
            collisionFilter: {
                category: balloonCategory,
                // Collide with walls and other balloons, not tails
                mask: wallCategory | balloonCategory 
            }
        });

        const balloonElement = document.createElement('div');
        balloonElement.classList.add('balloon');
        requestAnimationFrame(() => {
            balloonElement.classList.add('added');
        });
        balloonElement.style.width = `${size * 2}px`;
        balloonElement.style.height = `${size * 2 * 1.2}px`;
        balloonElement.style.backgroundColor = balloonColor;
        balloonElement.style.color = balloonColor; // For the knot border-top-color

        const tooltip = document.createElement('div');
        tooltip.classList.add('balloon-tooltip');
        tooltip.textContent = 'Click to view tasks';
        balloonElement.appendChild(tooltip);

        const modal = createModal(text);
        skyBackground.appendChild(modal);
        skyBackground.appendChild(balloonElement);
        
        const tailSegments = 15;
        const segmentSize = 0.5; // Even thinner thread
        const tailComposite = Composite.create({ label: 'Tail' });
        let previous = balloonBody;

        for (let i = 0; i < tailSegments; i++) {
            const segment = Bodies.circle(x, y + size + (i * 8), segmentSize, {
                frictionAir: 0.12,
                restitution: 0.4,
                render: { visible: false }, // Segments are invisible
                collisionFilter: {
                    // Tails don't collide with anything
                    mask: 0
                }
            });
            Composite.add(tailComposite, segment);

            let constraintOptions = {
                bodyA: previous,
                bodyB: segment,
                stiffness: 0.7,
                length: 8,
                render: { visible: false } // We will draw it manually
            };
            
            // --- Centered Tail Attachment ---
            if (i === 0) {
                constraintOptions.pointA = { x: 0, y: size }; // Attach to bottom of balloon
            }

            const constraint = Constraint.create(constraintOptions);
            Composite.add(tailComposite, constraint);
            previous = segment;
        }

        // Target height must be below the controls
        const minTargetY = controlOffset + size + 20;
        const maxTargetY = skyBackground.clientHeight - size - 50;
        const targetY = Math.max(minTargetY, Math.min(maxTargetY, (Math.random() * (maxTargetY - minTargetY) + minTargetY)));

        const balloon = {
            body: balloonBody,
            tail: tailComposite,
            element: balloonElement,
            text: text,
            modal: modal,
            targetY: targetY,
            size: size,
            driftPhase: Math.random() * Math.PI * 2,
            color: balloonColor
        };
        
        balloons.push(balloon);
        World.add(world, [balloon.body, balloon.tail]);

        // --- Event listeners omitted for brevity ---
        balloonElement.addEventListener('click', (e) => { e.stopPropagation(); toggleFocus(balloon); });
        modal.querySelector('.close-button').addEventListener('click', (e) => { e.stopPropagation(); toggleFocus(balloon); });
        modal.querySelector('.complete-button').addEventListener('click', (e) => {
            e.stopPropagation();
            const burstX = balloon.body.position.x;
            const burstY = balloon.body.position.y;
            
            balloonElement.classList.add('popping');
            modal.classList.remove('show');
            
            // Trigger confetti burst
            for (let i = 0; i < 20; i++) {
                createConfetti(burstX, burstY, balloon.color);
            }

            const balloonIndex = balloons.findIndex(b => b === balloon);
            if (balloonIndex > -1) {
                World.remove(world, [balloons[balloonIndex].body, balloons[balloonIndex].tail]);
                balloons.splice(balloonIndex, 1);
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
            if (newText) { balloon.text = newText; modal.querySelector('p').textContent = newText; }
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
        
        // Unfocus any currently focused balloon
        if (focusedBalloon) {
            focusedBalloon.element.classList.remove('focus');
            focusedBalloon.modal.classList.remove('show');
            sky.classList.remove('dimmed');
            
            // --- Stop manual control ---
            Body.setStatic(focusedBalloon.body, false);
        }

        focusedBalloon = null; // Reset

        // If the clicked balloon wasn't the one already focused, focus it
        if (!wasFocused) {
            focusedBalloon = balloon;
            focusedBalloon.element.classList.add('focus');
            focusedBalloon.modal.classList.add('show');
            sky.classList.add('dimmed');
            
            // --- Keep balloon still while focused ---
            Body.setStatic(focusedBalloon.body, true);
            Body.setAngle(focusedBalloon.body, 0);

            // --- Adjust modal position to stay within the sky div ---
            const modal = balloon.modal;
            const size = balloon.size;

            // Must display the modal to get its dimensions
            const modalRect = modal.getBoundingClientRect();

            // Balloon center position (body position is more reliable)
            const balloonX = balloon.body.position.x;
            const balloonY = balloon.body.position.y;

            // Desired position: right of the balloon, vertically centered
            let modalLeft = balloonX + size + 15;
            let modalTop = balloonY - modalRect.height / 2;

            // Check right boundary
            if (modalLeft + modalRect.width > skyBackground.clientWidth) {
                // Flip to left side
                modalLeft = balloonX - size - modalRect.width - 15;
            }

            // Check left boundary
            if (modalLeft < 0) {
                modalLeft = 10;
            }

            // Check top boundary
            if (modalTop < 0) {
                modalTop = 10;
            }

            // Check bottom boundary
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
        ctx.strokeStyle = '#333333'; // Dark gray / Black
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        balloons.forEach(balloon => {
            const segments = balloon.tail.bodies;
            if (segments.length === 0) return;

            ctx.beginPath();
            // Start at the bottom of the balloon
            const angle = balloon.body.angle;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const startX = balloon.body.position.x + (-sin * 0 + cos * 0);
            const startY = balloon.body.position.y + (sin * 0 + cos * balloon.size);
            
            ctx.moveTo(startX, startY);

            for (let i = 0; i < segments.length; i++) {
                // Add a procedural squiggle that increases as it goes down the tail
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
                // Slow drift behavior
                balloon.driftPhase += 0.005;
                const driftOffset = Math.sin(balloon.driftPhase) * 50;
                const currentTargetY = balloon.targetY + driftOffset;

                const dy = currentTargetY - body.position.y;
                const verticalForce = dy * 0.00005; 
                const floatingForce = -0.0042 * body.mass; // Slightly increased buoyancy
                const horizontalForce = (Math.random() - 0.5) * 0.0005;

                Body.applyForce(body, body.position, {
                    x: horizontalForce,
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
});
