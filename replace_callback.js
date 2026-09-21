/* Temporary script - replace discordCallback body with proxy mode support */
const fs = require('fs');
const p = 'server/controllers/authController.js';
let c = fs.readFileSync(p, 'utf8');

const lines = c.split('\n');

// Find start and end lines by content
let startIdx = -1;
let endIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('แลก code เป็น access token') && startIdx === -1) {
        startIdx = i;
    }
    if (startIdx !== -1 && lines[i].includes('res.redirect') && lines[i].includes('fallbackPage') && lines[i].includes('params.toString')) {
        endIdx = i;
        break;
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.log('ERROR: Could not find sections to replace');
    console.log('startIdx:', startIdx, 'endIdx:', endIdx);
    process.exit(1);
}

console.log('Found section:', startIdx, 'to', endIdx);

// New code
const newLines = [
    '        // ใช้ proxy ถ้ามีการกำหนดค่า (สำหรับ Inwcloud ที่ใช้ IP ร่วมกัน)',
    '        let discordId, discordUserId, discordName, discordAvatar;',
    '',
    '        if (config.DISCORD_PROXY_URL) {',
    '            const response = await fetch(config.DISCORD_PROXY_URL + \'/api/discord/exchange\', {',
    '                method: \'POST\',',
    '                headers: { \'Content-Type\': \'application/json\' },',
    '                body: JSON.stringify({ code, state })',
    '            });',
    '            if (!response.ok) {',
    '                const err = await response.json();',
    '                throw new Error(err.error || \'Discord proxy failed\');',
    '            }',
    '            const data = await response.json();',
    '            discordId = data.discord_id;',
    '            discordUserId = data.discord_userId;',
    '            discordName = data.discord_name;',
    '            discordAvatar = data.discord_avatar || \'\';',
    '        } else {',
    '            // แลก code เป็น access token',
    '            const accessToken = await discordAuth.exchangeCode(code);',
    '',
    '            // ดึงข้อมูล user',
    '            const userInfo = await discordAuth.getUserInfo(accessToken);',
    '',
    '            // สร้าง Discord ID string',
    '            discordId = userInfo.discriminator && userInfo.discriminator !== \'0\'',
    '                ? `${userInfo.username}#${userInfo.discriminator}`',
    '                : userInfo.username;',
    '            discordUserId = userInfo.id;',
    '            discordName = userInfo.displayName;',
    '            discordAvatar = userInfo.avatar || \'\';',
    '        }',
    '',
    '        // สร้าง URL parameters',
    '        const params = new URLSearchParams({',
    '            discord_id: discordId,',
    '            discord_userId: discordUserId,',
    '            discord_name: discordName,',
    '            discord_avatar: discordAvatar,',
    '            auth: \'success\'',
    '        });',
    '',
    '        // ตรวจสอบ state เพื่อ redirect กลับไปหน้าที่ถูกต้อง',
    '        res.redirect(`${fallbackPage}?${params.toString()}`);'
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('SUCCESS: Replaced lines', startIdx, 'to', endIdx);
