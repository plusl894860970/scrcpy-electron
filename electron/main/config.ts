import { join } from 'path'
import { app } from 'electron'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')

const scrcpyDir = join(app.isPackaged ? join(process.env.DIST, '../../') : join(process.env.DIST_ELECTRON, '../electron'), './library/scrcpy')

console.log('scrcpyDir', scrcpyDir)

export { scrcpyDir }