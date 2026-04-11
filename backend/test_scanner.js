import { scanSingleStock } from './src/services/scanner.js';
scanSingleStock('YEOTK').then(console.log).catch(console.error);
