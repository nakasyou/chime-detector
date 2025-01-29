/**
 * @module
 * @example
 * ```ts
 * const stop = await startDetection((t) => console.log('Chime detected', t))
 * ```
 */

/**
 * Main
 * @param listener Listener
 * @param getTime A function to get time
 * @returns A function to stop detection
 */
export const startDetection = async (
  listener: (soundedTime: number) => void,
  getTime: () => number = () => performance.now()
): Promise<() => void> => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })

  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()

  analyser.fftSize = 2048
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  source.connect(analyser)
  /*
  const $canvas = document.getElementById('graph') as HTMLCanvasElement
  const ctx = $canvas.getContext('2d') as CanvasRenderingContext2D
  const canvasRect = $canvas.getBoundingClientRect()*/

  function getFrequencyIndex(targetFrequency: number): number {
    if (!audioContext || !analyser) {
      console.error("AudioContext または AnalyserNode が無効です。");
      return -1; // エラーを示す値を返す
    }

    const sampleRate = audioContext.sampleRate;
    const fftSize = analyser.fftSize;
    const frequencyBinCount = analyser.frequencyBinCount; // fftSize / 2
    const frequencyResolution = sampleRate / fftSize;

    // インデックスを計算 (四捨五入)
    const targetIndex = Math.round(targetFrequency / frequencyResolution);

    // インデックスが有効範囲内か確認
    if (targetIndex >= 0 && targetIndex < frequencyBinCount) {
      return targetIndex;
    } else {
      console.warn(`指定された周波数 ${targetFrequency} Hz は、有効な範囲外です。`);
      return -1; // 範囲外を示す値を返す
    }
  }

  const rangeStart = 0
  const rangeEnd = 200
  //const graphWidth = $canvas.width / (rangeEnd - rangeStart)

  const CHIME_FREQUENCIES = [
    650,
    1180,
    1560,
    2093,
    2490,
    3000
  ]

  const CHIME_FREQUENCIE_INDEXES = CHIME_FREQUENCIES.map(frequency => getFrequencyIndex(frequency))

  const lastData: {
    time: number
    chimeAvr: number // チャイムの音の平均値
    noChimeAvr: number // チャイム以外の音の平均値
  }[] = []

  let cleanupped = false

  const step = () => {
    analyser.getByteFrequencyData(dataArray)
    
    /*ctx.clearRect(0, 0, $canvas.width, $canvas.height)
    for (let i = rangeStart; i < rangeEnd; i++) {
      ctx.fillStyle = CHIME_FREQUENCIE_INDEXES.includes(i) ? 'red' : 'black'

      // 0~255の値を0~canvas.heightの範囲に変換
      const barHeight = dataArray[i] / 255 * $canvas.height
      const x = graphWidth * i
      const y = $canvas.height - barHeight
      ctx.fillRect(x, y, graphWidth, barHeight)
    }*/

    // process data
    let chimeSum = 0
    let chimeCount = 0
    let noChimeSum = 0
    let noChimeCount = 0

    const scoreHistory: number[] = []
    for (let i = rangeStart; i < rangeEnd; i++) {
      if (CHIME_FREQUENCIE_INDEXES.includes(i)) {
        chimeSum += dataArray[i]
        chimeCount++
      } else {
        noChimeSum += dataArray[i]
        noChimeCount++
      }
    }
    lastData.push({
      time: getTime(),
      chimeAvr: chimeCount === 0 ? 0 : chimeSum / chimeCount,
      noChimeAvr: noChimeCount === 0 ? 0 : noChimeSum / noChimeCount
    })
    // remove old data
    if (lastData.length > 20) {
      lastData.shift()
    }
    // チャイムなったかどうか判定
    const last10ChimeAvr = lastData.slice(-10).reduce((sum, data) => sum + data.chimeAvr, 0) / 10
    //const last10NoChimeAvr = lastData.slice(-10).reduce((sum, data) => sum + data.noChimeAvr, 0) / 10

    const score = last10ChimeAvr // last10NoChimeAvr
    scoreHistory.push(score)
    const scoreHistoryAvr = lastData.slice(-10).reduce((sum, data) => sum + data.noChimeAvr, 0) / 10

    const normScore = score / scoreHistoryAvr
    if (normScore > 2) {
      // チャイムが鳴った
      const chimeTime = lastData.at(-10)!.time // 鳴った時刻
      listener(chimeTime)
    }

    if (scoreHistory.length > 600) {
      scoreHistory.shift()
    }

    if (cleanupped) {
      return
    }
    requestAnimationFrame(step)
  }
  step()

  return () => {
    source.disconnect()
    analyser.disconnect()
    audioContext.close()
    stream.getTracks().forEach(track => track.stop())
    cleanupped = true
  }
}

export {}
