const https = require('https');
const url = 'https://docs.google.com/spreadsheets/d/1WjK5FkKr6C_X6isFgIIf_3VUlEOhgA2NCxfbKalcQOs/gviz/tq?tqx=out:csv&tq&sheet=NamePD&_t=' + Date.now();
https.get(url, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        const lines = d.split('\n').slice(0, 5);
        console.log('=== NamePD (first 5 rows) ===');
        lines.forEach((l, i) => console.log('Row ' + i + ': ' + l));
        console.log('\n--- Now checking OutDC ---');
        const url2 = 'https://docs.google.com/spreadsheets/d/1WjK5FkKr6C_X6isFgIIf_3VUlEOhgA2NCxfbKalcQOs/gviz/tq?tqx=out:csv&tq&sheet=OutDC&_t=' + Date.now();
        https.get(url2, (res2) => {
            let d2 = '';
            res2.on('data', c => d2 += c);
            res2.on('end', () => {
                const lines2 = d2.split('\n').slice(0, 5);
                console.log('=== OutDC (first 5 rows) ===');
                lines2.forEach((l, i) => console.log('Row ' + i + ': ' + l));
            });
        }).on('error', e => console.error('OutDC error: ' + e.message));
    });
}).on('error', e => console.error('NamePD error: ' + e.message));