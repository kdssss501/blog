<div class="card">
  <svg
    class="doodle star"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L15 9L22 10L17 15L18.5 22L12 18.5L5.5 22L7 15L2 10L9 9L12 2Z"
    ></path>
  </svg>
  <svg
    class="doodle sparkle"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 0C12 6.6 17.4 12 24 12C17.4 12 12 17.4 12 24C12 17.4 6.6 12 0 12C6.6 12 12 6.6 12 0Z"
    ></path>
  </svg>
  <svg
    class="doodle swirl"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M50 10C27.9 10 10 27.9 10 50C10 72.1 27.9 90 50 90C72.1 90 90 72.1 90 50C90 32.3 75.7 18 58 18C44.3 18 33 29.3 33 43C33 53.5 41.5 62 52 62C59.7 62 66 55.7 66 48"
    ></path>
  </svg>

  <div class="card-photo"></div>

  <div class="card-title">
    HARI PATEL<br />
    <span>Fullstack Dev &amp; UX UI</span>
  </div>

  <div class="card-socials">
    <button class="card-socials-btn facebook" aria-label="Facebook">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16.75 9H13.5V7C13.5 6.45 13.95 6 14.5 6H16.5V2H14C11.79 2 10 3.79 10 6V9H8V12H10V21H13.5V12H16L16.75 9Z"
        ></path>
      </svg>
    </button>
    <button class="card-socials-btn github" aria-label="GitHub">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 0C5.37 0 0 5.37 0 12C0 17.31 3.435 21.8 8.205 23.385C8.805 23.495 9 23.125 9 22.81C9 22.535 8.99 21.67 8.985 20.655C5.645 21.38 4.94 19.045 4.94 19.045C4.395 17.655 3.61 17.285 3.61 17.285C2.525 16.545 3.69 16.56 3.69 16.56C4.89 16.645 5.525 17.795 5.525 17.795C6.595 19.63 8.33 19.1 9.015 18.79C9.12 18.01 9.435 17.48 9.785 17.18C7.12 16.88 4.325 15.85 4.325 11.235C4.325 9.92 4.795 8.845 5.56 7.99C5.435 7.685 5.025 6.465 5.675 4.825C5.675 4.825 6.685 4.5 8.985 6.06C9.945 5.795 10.975 5.665 12 5.66C13.025 5.665 14.055 5.795 15.015 6.06C17.315 4.5 18.325 4.825 18.325 4.825C18.975 6.465 18.565 7.685 18.445 7.99C19.21 8.845 19.675 9.92 19.675 11.235C19.675 15.865 16.875 16.875 14.205 17.17C14.635 17.54 15.02 18.265 15.02 19.385C15.02 20.99 15.005 22.28 15.005 22.81C15.005 23.13 15.2 23.51 15.815 23.385C20.57 21.795 24 17.305 24 12C24 5.37 18.63 0 12 0Z"
        ></path>
      </svg>
    </button>
    <button class="card-socials-btn linkedin" aria-label="LinkedIn">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20.447 20.452H16.92V14.88C16.92 13.55 16.896 11.84 15.074 11.84C13.228 11.84 12.945 13.28 12.945 14.786V20.452H9.423V9H12.8V10.561H12.848C13.318 9.673 14.464 8.742 16.143 8.742C19.667 8.742 20.447 11.062 20.447 14.032V20.452ZM5.337 7.433C4.204 7.433 3.285 6.516 3.285 5.385C3.285 4.254 4.204 3.336 5.337 3.336C6.467 3.336 7.387 4.254 7.387 5.385C7.387 6.516 6.467 7.433 5.337 7.433ZM7.1 20.452H3.571V9H7.1V20.452Z"
        ></path>
      </svg>
    </button>
  </div>
</div>

<style>
  .card {
    /* Cute Doodle Palette */
    --bg-color: #fdfbf7;
    --ink-color: #2c2c2c;
    --paper-line: #e6e0d4;
    --tape-color: rgba(255, 221, 161, 0.85);
    --accent-coral: #ff8ba7;
    --accent-mint: #c6e377;
    --accent-lavender: #c0bbfe;
    --accent-yellow: #ffdf6c;

    font-size: 16px;
    position: relative;
    width: 17em;
    background:
      linear-gradient(var(--bg-color) 1.5em, transparent 1.5em) 0 0 / 100% 1.6em,
      linear-gradient(var(--paper-line) 0.08em, transparent 0.08em) 0 1.5em / 100%
        1.6em var(--bg-color);
    border: 0.25em solid var(--ink-color);
    /* Hand-drawn sketchy border radius */
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    box-shadow:
      0.5em 0.5em 0 var(--ink-color),
      inset 0 0 1.2em rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3em 1.5em 2em;
    transition:
      transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
      box-shadow 0.4s ease,
      border-radius 0.4s ease;
    animation: floatCard 6s ease-in-out infinite;
    z-index: 1;
  }

  /* Paper Tape Corner */
  .card::before {
    content: "";
    position: absolute;
    top: -0.7em;
    left: 50%;
    transform: translateX(-50%) rotate(-4deg);
    width: 5em;
    height: 1.4em;
    background: var(--tape-color);
    border: 0.1em solid rgba(0, 0, 0, 0.1);
    box-shadow: 0.1em 0.1em 0.2em rgba(0, 0, 0, 0.1);
    border-radius: 2px 4px 2px 5px;
    z-index: 10;
    animation: tapeFlutter 4s infinite alternate ease-in-out;
  }

  /* Hover Dynamics */
  .card:hover {
    transform: translateY(-0.8em) rotate(1deg);
    box-shadow:
      0.7em 0.9em 0 var(--ink-color),
      inset 0 0 1.2em rgba(0, 0, 0, 0.03);
    border-radius: 15px 255px 15px 225px / 255px 15px 225px 15px; /* Border sketch shift */
  }

  /* --- DOODLE DECORATIONS --- */
  .doodle {
    position: absolute;
    fill: none;
    stroke: var(--ink-color);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    z-index: 0;
  }
  .doodle.star {
    width: 1.8em;
    height: 1.8em;
    top: 1.5em;
    right: 1.5em;
    fill: var(--accent-yellow);
    animation: pulseSparkle 3s infinite alternate ease-in-out;
  }
  .doodle.sparkle {
    width: 1.5em;
    height: 1.5em;
    top: 4em;
    left: 1.5em;
    fill: var(--accent-mint);
    animation: pulseSparkle 2.5s infinite alternate-reverse ease-in-out;
  }
  .doodle.swirl {
    width: 2.5em;
    height: 2.5em;
    bottom: 2em;
    right: 1em;
    stroke: var(--accent-lavender);
    stroke-width: 6;
    opacity: 0.6;
    animation: rotateDoodle 15s linear infinite;
  }

  /* --- AVATAR / PHOTO --- */
  .card-photo {
    width: 6.5em;
    height: 6.5em;
    position: relative;
    margin-bottom: 1.2em;
    background: 
      /* Spiky Hair */
      radial-gradient(
        circle at 25% 10%,
        var(--accent-lavender) 15%,
        transparent 16%
      ),
      radial-gradient(
        circle at 50% 5%,
        var(--accent-lavender) 18%,
        transparent 19%
      ),
      radial-gradient(
        circle at 75% 10%,
        var(--accent-lavender) 15%,
        transparent 16%
      ),
      /* Hair Base */
        radial-gradient(
          ellipse at 50% 20%,
          var(--accent-lavender) 45%,
          transparent 46%
        ),
      /* Skin Tone */ #ffdeb3;
    border: 0.2em solid var(--ink-color);
    border-radius: 40% 60% 55% 45% / 50% 45% 55% 50%;
    box-shadow: 0.3em 0.3em 0 var(--accent-coral);
    animation: avatarBounce 4s ease-in-out infinite;
    overflow: hidden;
    z-index: 2;
  }

  /* Face Details (Eyes & Blush) */
  .card-photo::before {
    content: "";
    position: absolute;
    width: 0.55em;
    height: 0.55em;
    background: var(--ink-color);
    border-radius: 50%;
    top: 3.2em;
    left: 1.8em;
    /* Right eye + two pink blushes */
    box-shadow:
      2.3em 0 0 var(--ink-color),
      -0.4em 0.9em 0.3em rgba(255, 139, 167, 0.8),
      2.7em 0.9em 0.3em rgba(255, 139, 167, 0.8);
    animation: avatarBlink 5s infinite;
    transform-origin: center;
  }

  /* Face Details (Smile) */
  .card-photo::after {
    content: "";
    position: absolute;
    width: 1.4em;
    height: 1.2em;
    border: 0.2em solid transparent;
    border-bottom-color: var(--ink-color);
    border-radius: 50%;
    top: 2.2em;
    left: 2.35em;
    animation: smileMove 3s ease-in-out infinite alternate;
  }

  /* --- TYPOGRAPHY --- */
  .card-title {
    text-align: center;
    color: var(--ink-color);
    font-size: 1.3em;
    font-weight: 900;
    font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif;
    letter-spacing: 0.05em;
    margin-bottom: 0.5em;
    text-shadow: 0.08em 0.08em 0 var(--accent-lavender);
    z-index: 2;
  }

  .card:hover .card-title {
    animation: titleWobble 0.6s ease-in-out infinite alternate;
  }

  /* Role Badge */
  .card-title span {
    display: inline-block;
    font-size: 0.55em;
    color: var(--ink-color);
    background: var(--accent-mint);
    padding: 0.4em 1em;
    border: 0.15em solid var(--ink-color);
    border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px;
    margin-top: 0.8em;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    box-shadow: 0.2em 0.2em 0 var(--ink-color);
    animation: badgeFloat 3s ease-in-out infinite alternate;
    text-shadow: none;
  }

  /* --- SOCIAL BUTTONS --- */
  .card-socials {
    display: flex;
    gap: 1em;
    height: 0;
    opacity: 0;
    margin-top: 0;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 2;
  }

  .card:hover .card-socials {
    height: 3em;
    opacity: 1;
    margin-top: 1.5em;
    overflow: visible;
  }

  .card-socials-btn {
    width: 2.8em;
    height: 2.8em;
    border: 0.15em solid var(--ink-color);
    background: #fff;
    border-radius: 50% 40% 60% 40% / 40% 60% 40% 50%; /* Skewed circle */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0.2em 0.2em 0 var(--ink-color);
    transition: all 0.2s ease;
  }

  .card-socials-btn svg {
    width: 1.4em;
    height: 1.4em;
    fill: var(--ink-color);
    transition: transform 0.2s ease;
  }

  /* Interactive Button States */
  .card-socials-btn.facebook:hover {
    background: var(--accent-lavender);
  }
  .card-socials-btn.github:hover {
    background: var(--accent-coral);
  }
  .card-socials-btn.linkedin:hover {
    background: var(--accent-mint);
  }

  .card-socials-btn:hover {
    transform: translateY(-0.3em);
    animation: btnWiggle 0.6s ease-in-out infinite;
  }

  .card-socials-btn:focus-visible {
    outline: 0.2em dashed var(--accent-coral);
    outline-offset: 0.3em;
    transform: translateY(-0.3em);
  }

  .card-socials-btn:active {
    transform: translate(0.1em, 0.1em);
    box-shadow: 0.05em 0.05em 0 var(--ink-color);
    animation: none;
  }

  /* --- ANIMATIONS KEYFRAMES --- */
  @keyframes floatCard {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-0.4em);
    }
  }

  @keyframes tapeFlutter {
    0% {
      transform: translateX(-50%) rotate(-4deg) scale(1);
    }
    100% {
      transform: translateX(-50%) rotate(-2deg) scale(1.02);
    }
  }

  @keyframes pulseSparkle {
    0% {
      transform: scale(0.8);
      opacity: 0.6;
    }
    100% {
      transform: scale(1.1);
      opacity: 1;
    }
  }

  @keyframes rotateDoodle {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes avatarBounce {
    0%,
    100% {
      transform: translateY(0) scale(1);
      border-radius: 40% 60% 55% 45% / 50% 45% 55% 50%;
    }
    50% {
      transform: translateY(-0.3em) scale(1.02);
      border-radius: 45% 55% 50% 50% / 45% 50% 50% 55%;
    }
  }

  @keyframes avatarBlink {
    0%,
    4%,
    10%,
    100% {
      transform: scaleY(1);
    }
    5%,
    8% {
      transform: scaleY(0.1);
    }
  }

  @keyframes smileMove {
    0% {
      transform: translateY(0) scaleX(1);
    }
    100% {
      transform: translateY(-0.1em) scaleX(1.1);
    }
  }

  @keyframes titleWobble {
    0% {
      transform: rotate(-2deg) scale(1.02);
    }
    100% {
      transform: rotate(2deg) scale(1.02);
    }
  }

  @keyframes badgeFloat {
    0% {
      transform: translateY(0) rotate(-1deg);
    }
    100% {
      transform: translateY(-0.2em) rotate(1deg);
    }
  }

  @keyframes btnWiggle {
    0%,
    100% {
      transform: translateY(-0.3em) rotate(0deg);
    }
    25% {
      transform: translateY(-0.3em) rotate(-8deg);
    }
    75% {
      transform: translateY(-0.3em) rotate(8deg);
    }
  }
</style>
