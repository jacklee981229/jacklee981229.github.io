// Declare the fireworks array using const
const fireworks = [];
const num_particules = 30;

// Animate the exploding fireworks using an arrow function
const animateFireworks = () => {
    for (let i = 0; i < fireworks.length; i++) {
        const firework = fireworks[i];

        // Remove fireworks that have faded out
        if (firework.alpha <= -1110) {
            firework.el.remove();
            fireworks.splice(i, 1);
            i--;
        }
        // Animate exploding fireworks
        else if (firework.exploded) {
            for (let j = 0; j < firework.particles.length; j++) {
                const particle = firework.particles[j];

                if (particle.alpha <= 0) {
                    particle.el.remove();
                    firework.particles.splice(j, 1);
                    j--;
                } else {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.vy += particle.gravity;
                    particle.alpha -= 0.02;
                    particle.el.style.cssText = `left:${particle.x}px;top:${particle.y}px;opacity:${particle.alpha};background:${firework.color}`;
                }
            }

            firework.alpha -= 0.08;
            if (firework.alpha >= 0)
                firework.el.style.cssText = `left:${firework.x}px;top:${firework.y}px;opacity:${firework.alpha};background:${firework.color}`;
            
            if (firework.particles.length <= 0){
                firework.el.remove();
                fireworks.splice(i, 1);
                i--;
            }
        }
        // Animate launching fireworks
        else {
            firework.y -= firework.speed;
            firework.el.style.cssText = `left:${firework.x}px;top:${firework.y}px;opacity:${firework.alpha};background:${firework.color}`;
            if (firework.y <= firework.targetY) {
                firework.exploded = true;
                explodeFirework(firework);
            }
        }
    }

    requestAnimationFrame(animateFireworks);
};

// Handle click events on the page using an arrow function
const handlePageClick = () => {
    const previousClickHandler = window.onclick;

    window.onclick = (e) => {
        // Call any previous click handler
        if (previousClickHandler) {
            previousClickHandler(e);
        }

        // Add a new firework where the user clicked
        const firework = document.createElement("div");
        firework.className = "firework";

        const newFirework = {
            el: firework,
            x: e.clientX - 5,
            y: e.clientY - 5,
            targetY: getRandomInt(50, 150),
            alpha: 1,
            speed: getRandomDouble(3, 6),
            exploded: false,
            color: getRandomColor(),
            particles: []
        };

        fireworks.push(newFirework);
        document.body.appendChild(firework);
    };
};

// Add a click event handler to the page to start the animation
handlePageClick();

// Start the animation loop
animateFireworks();

// Inject CSS rules to style the firework element
const css = `
  .firework {
    width: 2px;
    height: 10px;
    position: fixed;
    background: #f00;
  }
  .firework-particle {
    width: 5px;
    height: 5px;
    position: fixed;
    background: #f00;
    border-radius: 50%;
    -webkit-border-radius: 50%;
    -moz-border-radius: 50%;
  }
`;

const injectFireworkStyles = (css) => {
    const style = document.createElement("style");
    style.type = "text/css";

    try {
        style.appendChild(document.createTextNode(css));
    } catch (e) {
        style.styleSheet.cssText = css;
    }

    document.head.appendChild(style);
};

injectFireworkStyles(css);

// Generate a random RGB color string using an arrow function
const getRandomColor = () => {
    const r = getRandomInt(0, 255);
    const g = getRandomInt(0, 255);
    const b = getRandomInt(0, 255);
    return `rgb(${r},${g},${b})`;
};

// Generate a random integer between min (inclusive) and max (exclusive)
const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

const getRandomDouble = (min, max) => {
    var range = max - min;
    return Math.round(min + range * Math.random(), 2);
};

// Explode a firework by creating particles
const explodeFirework = (firework) => {
    const {
        x,
        y,
        color
    } = firework;
    for (let i = 0; i < num_particules; i++) {
        const particle = document.createElement("div");
        particle.className = "firework-particle";
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const gravity = 0.1;
        const newParticle = {
            el: particle,
            x,
            y,
            vx,
            vy,
            gravity,
            alpha: 1,
        };
        firework.particles.push(newParticle);
        document.body.appendChild(particle);
    }
};