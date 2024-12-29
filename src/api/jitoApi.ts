import jitoServer from '@/utils/jitoAxios'

// 通过地址获取代币信息
export const jitoSendTranstion = (params: any) => {
  return jitoServer.post('/api/v1/transactions', params)
}
