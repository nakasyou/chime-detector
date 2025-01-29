import { startDetection } from './core'
import './index.css'

const $log = document.getElementById('log') as HTMLDivElement

const stop = await startDetection(t => {
  const time = t + performance.timeOrigin
  $log.innerHTML += `Sound detected at ${new Date(time)}, ${time % 1000}ms<br>`
  stop()
})
