import * as path from 'path';
import { getTsupConfig, preBuild } from '../common/build.js';

await preBuild('sa360', path.resolve('..'));
export default getTsupConfig(__dirname, 'dist');
