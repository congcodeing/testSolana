import service from '@/utils/axios'

// 通过地址获取代币信息
export const getPumpTokenInfoByAddress = (params: any) => {
  return service({
    url: '/api/mint',
    method: 'post',
    data: params
  })
}

// 获取买入交易对象
export const getTransBuyQuery = (params: any) => {
  return service({
    url: '/api/buy',
    method: 'post',
    data: params
  })
}

// 获取卖出交易对象
export const getTransSellQuery = (params: any) => {
  return service({
    url: '/api/sell',
    method: 'post',
    data: params
  })
}
