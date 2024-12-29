import { local } from '@/utils/storage.ts'
import type { AxiosInstance, AxiosResponse } from 'axios'
import axios from 'axios'

const service: AxiosInstance = axios.create({
  baseURL: 'http://101.44.68.231:3000',
  timeout: 30 * 1000, // 请求超时时间
  headers: { 'Content-Type': 'application/json;charset=UTF-8' }
})

// 拦截器
service.interceptors.request.use((config: any) => {
  const token = local.getItem('token') || ''

  if (token) {
    config.headers.token = token
  }
  return config
})

// 响应器
service.interceptors.response.use(
  // 响应成功的处理    401: token过期  0: 成功,一般是操作失败返回的错误
  (response: AxiosResponse) => {
    const data = response.data
    if (data.code === 1) {
      return data.data
    } else {
      return Promise.reject(data)
    }
  },
  // 响应失败的处理  一般是服务器出错  或者请求超时
  (err: any) => {
    return Promise.reject(err.response)
  }
)

export default service
