const fs = require('fs');
const files = ['c:/Users/arish/OneDrive/Desktop/milk delivery/index.css', 'c:/Users/arish/OneDrive/Desktop/milk delivery/settings-styles.css', 'c:/Users/arish/OneDrive/Desktop/milk delivery/index.html'];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let text = fs.readFileSync(file, 'utf8');

    // Replace old hex values
    text = text.replace(/#2563EB/gi, '#6366F1');
    text = text.replace(/#1E3A8A/gi, '#4338CA');
    text = text.replace(/#1D4ED8/gi, '#4F46E5');
    text = text.replace(/#0EA5E9/gi, '#06B6D4');
    text = text.replace(/#EFF6FF/gi, '#EEF2FF');

    fs.writeFileSync(file, text);
});
console.log('Hex code update complete.');
