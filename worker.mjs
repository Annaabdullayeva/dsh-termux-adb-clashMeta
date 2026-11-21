import {run} from './backend.mjs'
const action = process.argv[2]
if (process.argv.length !== 3 || !['status','on','off'].includes(action)) process.exit(2)
console.log(JSON.stringify(await run(action)))
