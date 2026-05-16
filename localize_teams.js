const fs = require('fs');

function localizeTeamRendering(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Localize getTeamHtml
    const getTeamHtmlRegex = /function getTeamHtml\(name\) \{[\s\S]*?return code \? `<img src="https:\/\/flagcdn\.com\/w40\/\$\{code\}\.png" class="flag-img"> \$\{name\}` : name;[\s\S]*?\}/g;
    content = content.replace(getTeamHtmlRegex, `function getTeamHtml(name) {
      const code = TEAM_CODES[name];
      const translatedName = window.i18n ? window.i18n.t(\`teams.\${name}\`) : name;
      return code ? \`<img src="https://flagcdn.com/w40/\${code}.png" class="flag-img"> \${translatedName}\` : translatedName;
    }`);

    // 2. Localize formatMatchWithFlags in pool.html
    const formatMatchWithFlagsRegex = /function formatMatchWithFlags\(matchStr\) \{[\s\S]*?if \(!matchStr\.includes\('-'\) && !matchStr\.includes\(' vs '\)\) return matchStr;[\s\S]*?let separator = matchStr\.includes\(' - '\) \? ' - ' : \(matchStr\.includes\(' vs '\) \? ' vs ' : '-'\);[\s\S]*?const parts = matchStr\.split\(separator\);[\s\S]*?if \(parts\.length === 2\) \{[\s\S]*?const home = parts\[0\]\.trim\(\);[\s\S]*?const away = parts\[1\]\.trim\(\);[\s\S]*?const homeCode = teamCodes \? teamCodes\[home\] : \(typeof TEAM_CODES !== 'undefined' \? TEAM_CODES\[home\] : null\);[\s\S]*?const awayCode = teamCodes \? teamCodes\[away\] : \(typeof TEAM_CODES !== 'undefined' \? TEAM_CODES\[away\] : null\);[\s\S]*?const homeImg = homeCode \? `<img src="https:\/\/flagcdn\.com\/w40\/\$\{homeCode\}\.png" class="flag-img" style="margin-right:6px">` : '';[\s\S]*?const awayImg = awayCode \? `<img src="https:\/\/flagcdn\.com\/w40\/\$\{awayCode\}\.png" class="flag-img" style="margin-right:6px">` : '';[\s\S]*?return `<div style="display:flex; align-items:center;">[\s\S]*?\$\{home\} \$\{homeImg\}[\s\S]*?\$\{awayImg\} \$\{away\}[\s\S]*?<\/div>`;[\s\S]*?\}[\s\S]*?return matchStr;[\s\S]*?\}/g;
    content = content.replace(formatMatchWithFlagsRegex, `function formatMatchWithFlags(matchStr) {
      if (!matchStr.includes('-') && !matchStr.includes(' vs ')) {
        return window.i18n ? window.i18n.t(\`teams.\${matchStr}\`) : matchStr;
      }
      
      let separator = matchStr.includes(' - ') ? ' - ' : (matchStr.includes(' vs ') ? ' vs ' : '-');
      const parts = matchStr.split(separator);
      if (parts.length === 2) {
        const home = parts[0].trim();
        const away = parts[1].trim();
        const homeCode = (typeof teamCodes !== 'undefined' ? teamCodes[home] : (typeof TEAM_CODES !== 'undefined' ? TEAM_CODES[home] : null));
        const awayCode = (typeof teamCodes !== 'undefined' ? teamCodes[away] : (typeof TEAM_CODES !== 'undefined' ? TEAM_CODES[away] : null));
        
        const homeTranslated = window.i18n ? window.i18n.t(\`teams.\${home}\`) : home;
        const awayTranslated = window.i18n ? window.i18n.t(\`teams.\${away}\`) : away;
        
        const homeImg = homeCode ? \`<img src="https://flagcdn.com/w40/\${homeCode}.png" class="flag-img" style="margin-right:6px">\` : '';
        const awayImg = awayCode ? \`<img src="https://flagcdn.com/w40/\${awayCode}.png" class="flag-img" style="margin-right:6px">\` : '';
        
        return \`<div style="display:flex; align-items:center;">
                  <div style="flex:1; text-align:right;">\${homeTranslated} \${homeImg}</div>
                  <div style="margin:0 8px; color:var(--text-muted); font-size:0.7rem;">\${separator.trim()}</div>
                  <div style="flex:1; text-align:left;">\${awayImg} \${awayTranslated}</div>
                </div>\`;
      }
      return matchStr;
    }`);

    // 3. Localize specific strings in worldcup.html
    content = content.replace(/phaseName\.innerHTML = `\$\{tournamentState\.name\} <span/g, "phaseName.innerHTML = `${window.i18n ? window.i18n.t('predictions.round_' + tournamentState.id) : tournamentState.name} <span");
    content = content.replace(/<div class="group-name">Grupo \$\{g\.letter\}<\/div>/g, '<div class="group-name">${window.i18n ? window.i18n.t(\'predictions.group\') : \'Grupo\'} ${g.letter}</div>');

    // 4. Localize sections in pool.html
    content = content.replace(/\{ section: 'PREMIOS INDIVIDUALES' \}/g, "{ section: (window.i18n ? window.i18n.t('dashboard.honor_label').toUpperCase() : 'PREMIOS INDIVIDUALES') }");
    
    fs.writeFileSync(filePath, content);
}

// Update files
['worldcup.html', 'pool.html', 'player_scores.html'].forEach(localizeTeamRendering);

console.log('Localization of team names and groups applied.');
