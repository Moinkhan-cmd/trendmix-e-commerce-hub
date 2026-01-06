const fs = require('fs'); let content = fs.readFileSync('src/lib/orders.ts', 'utf8'); content = content.replace(/\\\$/g, '$'); fs.writeFileSync('src/lib/orders.ts', content); console.log('Done');
