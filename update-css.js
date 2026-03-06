const fs = require('fs');
const files = ['c:/Users/arish/OneDrive/Desktop/milk delivery/index.css', 'c:/Users/arish/OneDrive/Desktop/milk delivery/settings-styles.css'];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let css = fs.readFileSync(file, 'utf8');

    // Replace royal blue rgba with vibrant indigo rgba
    css = css.replace(/rgba\(\s*37\s*,\s*99\s*,\s*235\s*,\s*([0-9.]+)\s*\)/g, 'rgba(99, 102, 241, $1)');

    // Replace old green rgba with emerald rgba
    css = css.replace(/rgba\(\s*22\s*,\s*163\s*,\s*74\s*,\s*([0-9.]+)\s*\)/g, 'rgba(16, 185, 129, $1)');

    // Replace old green hex codes
    css = css.replace(/#16A34A/gi, '#10B981');
    css = css.replace(/#15803D/gi, '#047857');

    // Modernize backdrop blurs
    css = css.replace(/backdrop-filter: blur\(([0-9]+)px\)/g, (match, p1) => {
        let newBlur = Math.min(parseInt(p1) + 4, 24);
        return `backdrop-filter: blur(${newBlur}px)`;
    });

    fs.writeFileSync(file, css);
});
console.log('CSS update complete.');
