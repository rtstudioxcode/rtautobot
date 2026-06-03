'use client';

const CSS = `
.sb-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1004;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  background: rgba(0,0,0,.58);
  backdrop-filter: blur(10px) saturate(1.08);
  -webkit-backdrop-filter: blur(10px) saturate(1.08);
  transition: opacity .22s ease, visibility .22s ease;
}
@media (min-width: 901px) {
  .sb-backdrop { display: none !important; }
}
body.sb-mobile-open .sb-backdrop {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
`;

export default function SbBackdrop() {
  function handleClick() {
    document.body.classList.remove('sb-mobile-open');
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="sbBackdrop" className="sb-backdrop" onClick={handleClick} />
    </>
  );
}
