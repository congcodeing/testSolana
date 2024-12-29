import { local } from '@/utils/storage.ts'
import type { AxiosInstance, AxiosResponse } from 'axios'
import axios from 'axios'

const jitoServer: AxiosInstance = axios.create({
  baseURL: '/baseUrl',
  timeout: 30 * 1000, // 请求超时时间
  headers: { 'Content-Type': 'application/json;charset=UTF-8' }
})

// 响应器
jitoServer.interceptors.response.use(
  (response: AxiosResponse) => {
    const data = response.data
    return data
  },
  // 响应失败的处理  一般是服务器出错  或者请求超时
  (err: any) => {
    return Promise.reject(err.response)
  }
)

export default jitoServer
