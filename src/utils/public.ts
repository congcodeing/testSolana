import { local } from '@/utils/storage'

// 获取随机数
export const randomInt = (end: number, start?: number) => {
  if (!end) return 0
  const number = start || 0
  return number + Math.floor(Math.random() * (end - number))
}

// 获取浏览器类型
export const getBrowser = () => {
  var UserAgent = navigator.userAgent.toLowerCase()
  var browserInfo = {}
  var browserArray = {
    // @ts-ignore
    IE: window.ActiveXObject || 'ActiveXObject' in window, // IE
    Chrome: UserAgent.indexOf('chrome') > -1 && UserAgent.indexOf('safari') > -1, // Chrome浏览器
    Firefox: UserAgent.indexOf('firefox') > -1, // 火狐浏览器
    Opera: UserAgent.indexOf('opera') > -1, // Opera浏览器
    Safari: UserAgent.indexOf('safari') > -1 && UserAgent.indexOf('chrome') == -1, // safari浏览器
    Edge: UserAgent.indexOf('edge') > -1, // Edge浏览器
    Quark: UserAgent.indexOf('quark') > -1, // 夸克浏览器
    Baidu: UserAgent.indexOf('baidu') > -1, // 百度浏览器
    MetaSr: UserAgent.indexOf('metasr') > -1, // 搜狗浏览器
    LBBROWSER: UserAgent.indexOf('lbbrowser') > -1, // 猎豹浏览器
    '360Browser': UserAgent.indexOf('360SE') !== -1 || UserAgent.indexOf('360EE') !== -1, // 360浏览器
    Maxthon: UserAgent.indexOf('maxthon') > -1, // 遨游浏览器
    UC: UserAgent.indexOf('ucbrowser') > -1, // UC浏览器
    TheWorld: UserAgent.indexOf('theworld') > -1, // 世界之窗浏览器
    QQBrowser: /qqbrowser/.test(UserAgent) || UserAgent.indexOf('qqbrowser') > -1, // qq浏览器
    WeixinBrowser: /MicroMessenger/i.test(UserAgent) // 微信浏览器
  }
  for (var i in browserArray) {
    // @ts-ignore
    if (browserArray[i]) {
      var versions = ''
      if (i == 'IE') {
        // @ts-ignore
        versions = UserAgent.match(/(msie\s|trident.*rv:)([\w.]+)/)[2]
      } else if (i == 'Chrome') {
        for (var mt in navigator.mimeTypes) {
          //检测是否是360浏览器(测试只有pc端的360才起作用)
          if (navigator.mimeTypes[mt]['type'] == 'application/360softmgrplugin') {
            i = '360'
          }
        } // @ts-ignore
        versions = UserAgent.match(/chrome\/([\d.]+)/)[1]
      } else if (i == 'Firefox') {
        // @ts-ignore
        versions = UserAgent.match(/firefox\/([\d.]+)/)[1]
      } else if (i == 'Opera') {
        // @ts-ignore
        versions = UserAgent.match(/opera\/([\d.]+)/)[1]
      } else if (i == 'Safari') {
        // @ts-ignore
        versions = UserAgent.match(/version\/([\d.]+)/)[1]
      } else if (i == 'Edge') {
        // @ts-ignore
        versions = UserAgent.match(/edge\/([\d.]+)/)[1]
      } else if (i == 'QQBrowser') {
        // @ts-ignore
        versions = UserAgent.match(/qqbrowser\/([\d.]+)/)[1]
      } // @ts-ignore
      browserInfo.type = i // @ts-ignore
      browserInfo.versions = parseInt(versions)
    }
  }
  return browserInfo
}

/**
 * 动态获取assets里的图片
 */
export function getAssetsImg(url: string): string {
  if (!url) return ''
  if (url.indexOf('http') > -1) return url
  return new URL(`../assets/images/${url}`, import.meta.url).href
}

type FormatO = {
  'M+': number
  'D+': number
  'H+': number
  'm+': number
  's+': number
  [key: string]: any
}

/**
 * 格式化日期
 * @param {Date|undefined} date
 * @param {String} format
 * @param {String} fill
 * @returns {String}
 */
export const formatTime = (date: any, format = 'YYYY-MM-DD', fill = true): string => {
  if (!date && !fill) return ''
  const cDate = date ? new Date(date) : new Date()
  if (!cDate) return ''
  const o: FormatO = {
    'M+': cDate.getMonth() + 1, // 月份
    'D+': cDate.getDate(), // 日
    'H+': cDate.getHours(), // 小时
    'm+': cDate.getMinutes(), // 分
    's+': cDate.getSeconds() // 秒
  }
  if (/(Y+)/.test(format)) {
    format = format.replace(RegExp.$1, (cDate.getFullYear() + '').substr(4 - RegExp.$1.length))
  }
  for (const k in o) {
    if (new RegExp('(' + k + ')').test(format)) {
      format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] : addZero(o[k]))
    }
  }
  return format
}

/**
 * 格式化时间
 */
export function timeString(value: any, fmt = 'YYYY-mm-dd HH:MM:SS') {
  let ret
  let date = value
  if (!value) return ''
  if (typeof value === 'string') {
    if (value.includes('-')) {
      date = new Date(value.replace(/-/g, '/'))
    } else {
      date = new Date(value)
    }
  }
  if (typeof value === 'number') {
    date = new Date(value)
  }
  const opt = {
    'Y+': date.getFullYear().toString(),
    'm+': (date.getMonth() + 1).toString(),
    'd+': date.getDate().toString(),
    'H+': date.getHours().toString(),
    'M+': date.getMinutes().toString(),
    'S+': date.getSeconds().toString()
  } as any
  for (let k in opt) {
    ret = new RegExp('(' + k + ')').exec(fmt)
    if (ret) {
      fmt = fmt.replace(ret[1], ret[1].length == 1 ? opt[k] : opt[k].padStart(ret[1].length, '0'))
    }
  }
  return fmt
}

/**
 * Add Zero
 * @param {String} num
 * @returns {String}
 */
const addZero = (num: string): string => {
  if (parseFloat(num) < 10) {
    return '0' + num
  }
  return num
}

/**
 * 生成指定范围内的随机数，并限制小数位数
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @param {number} decimalPlaces 小数位数
 * @returns {number} 随机数
 */
export const generateRandomNumber = (min: number, max: number, decimalPlaces: number) => {
  if (min > max) {
    return min
  }
  if (decimalPlaces < 0) {
    return min
  }

  const random = Math.random() * (max - min) + min
  return parseFloat(random.toFixed(decimalPlaces))
}

/**
 * 将一维数组按照指定长度切割为二维数组
 * @param {Array} array 一维数组
 * @param {number} size 每个子数组的长度
 * @returns {Array} 切割后的二维数组
 */
export const chunkArray = (array: Array<any>, size: number) => {
  if (!Array.isArray(array)) {
    return array
  }
  if (typeof size !== 'number' || size <= 0) {
    return array
  }

  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

/**
 * 模拟延迟的函数
 * @param {number} milliseconds 延迟的毫秒数
 * @returns {Promise<void>} 返回一个在指定时间后解决的 Promise
 */
export const delayCall = (milliseconds: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds)
  })
}
