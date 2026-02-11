import * as openclaw from 'openclaw';
console.log('OpenClaw Exports:', Object.keys(openclaw));
if (openclaw.default) {
    console.log('Default Export:', typeof openclaw.default);
    if (typeof openclaw.default === 'object') {
        console.log('Default Keys:', Object.keys(openclaw.default));
    }
}
