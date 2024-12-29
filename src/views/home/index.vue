<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useWeb3Store } from '@/stores/web3Store'
import { getPumpTokenInfoByAddress, getTransBuyQuery, getTransSellQuery } from '@/api/web3'
import { chunkArray, delayCall, generateRandomNumber } from '@/utils/public'
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import bs58 from 'bs58'
import { jitoSendTranstion } from '@/api/jitoApi'
import { timeString } from '@/utils/public'

const web3Store = useWeb3Store()
const { solanaTokenAddress, publicAddress, connectWallet } = web3Store

// 自动尝试连接钱包
onMounted(async () => {
  const transaction = await web3Store.connection.getTransaction('WqfKkFko5rS9ZZ8VqwuxjFpVH5ptPFBSFQDnVFsQAzKrX5FWSkGDBh68NQY97q9v6osAaML22EJmfpCUvUzSFP2')
  console.log(transaction)
  if (!publicAddress) {
    connectWallet()
  }
})

// 私钥字符串
const privateKeyText = ref('')
const privateKeyList = ref([] as string[])
const splitAddress = () => {
  // 将输入内容按行分割成数组
  privateKeyList.value = privateKeyText.value
    .split('\n') // 按换行符分割
    .map(item => item.trim()) // 去掉每行的首尾空格
    .filter(item => item) // 去掉空行
}

// 交易参数对象
const transQuery = reactive({
  totalTransStatus: 0, // 交易状态 0未开始 1进行中
  fromAddress: '', // 支付的代币地址
  getAddress: '', // 购买的代币地址
  concurrency: 1, // 并发量
  transactionType: 1, // 单次买卖金额类型 1固定金额 2随机
  transactionNum: '', // 固定买卖金额值
  transactionRandomMin: '', // 单次买卖金额随机最小值
  transactionRandomMax: '', // 单次买卖金额随机最大值
  transactionRandomDecimal: '', // 单次买卖金额随机小数
  jtoFree: '', // jto加速小费
  slip: '', // 滑点设置
  timeType: 1, // 时间间隔两位小数 1固定 2随机
  timeNum: '0.1', // 固定时间间隔
  timeRandomMin: '', // 时间间隔随机最小值
  timeRandomMax: '', // 时间间隔随机最大值
  totalTimes: '', // 总次数：(没填写的就持续)
  totalDuration: '' // 总时间：(没填写的就持续)
})
// 交易日志 日志状态 1发起交易成功 2发起交易失败 3正在等待交易确认 4交易确认完成 5交易确认失败 6五秒内无法确认交易
const transLog = ref([] as any)

// 切换交易代币选择
const changeSwampAddress = async (type: number) => {
  if (transQuery.fromAddress === solanaTokenAddress && transQuery.getAddress === solanaTokenAddress) {
    if (type === 1) {
      transQuery.getAddress = ''
    } else {
      transQuery.fromAddress = ''
    }
  } else if (type === 1 && transQuery.fromAddress !== solanaTokenAddress) {
    transQuery.getAddress = solanaTokenAddress
  } else if (type === 2 && transQuery.getAddress !== solanaTokenAddress) {
    transQuery.fromAddress = solanaTokenAddress
  }
}

// 获取交易对象
const fetchTransaction = async (transType: number, userAddress: string, solAmount: number, mint: string, curve: string, ata: string, slip: number) => {
  try {
    let res = {} as any
    if (transType === 1) {
      res = await getTransBuyQuery({
        mint, // 目标代币的 mint 地址
        curve, // 代币的 curve 地址
        ata, // 代币的 ata 地址
        address: userAddress, // 用户钱包地址
        sol: solAmount, // SOL 数量（lamports 单位）
        slip // 滑点
      })
    } else {
      res = await getTransSellQuery({
        mint, // 目标代币的 mint 地址
        curve, // 代币的 curve 地址
        ata, // 代币的 ata 地址
        address: userAddress, // 发起交易的地址（base58 的公钥）
        amount: solAmount, // 要卖出代币的数量 以decimals为标准的最小单 如果代币的decimals为6 那么我有123个代币 实际参数就为123*1000000 即 123000000
        slip // 整数  滑点 以千之一 计算的，如我要设置滑点为0.5% 这里就传入50 （相当于 0.5% * 1000）
      })
    }
    console.log('交易对象', res)
    return res
  } catch (error) {
    console.log('获取交易对象错误', error)
    return {}
  }
}

// 签名交易
const signTransactionWithPhantom = async (instructions: any, publicKey: any, privateKey: any) => {
  // 创建一个 Solana Transaction 对象
  const transaction = new Transaction()
  // 使用 bs58 解码 Base58 格式的私钥为 Uint8Array
  const secretKey = bs58.decode(privateKey)
  // 使用私钥生成密钥对
  const keypair = Keypair.fromSecretKey(secretKey)

  // 将后端返回的指令添加到 Transaction 中
  instructions.forEach((instruction: any) => {
    transaction.add({
      keys: instruction.keys.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable
      })),
      programId: new PublicKey(instruction.programId),
      // @ts-ignore
      data: new Uint8Array(instruction.data)
    })
  })

  // 添加 Jito 小费的转账指令
  if (transQuery.jtoFree) {
    // 设置每个计算单元的价格为 lamports (1 SOL = 1e9 lamports)
    const jitoTipAmount = +transQuery.jtoFree * LAMPORTS_PER_SOL
    const tempList = new Uint8Array(12)
    tempList[0] = 2
    const tempItem1 = new DataView(tempList.buffer)
    tempItem1.setBigInt64(4, BigInt(jitoTipAmount), true)
    const tempData = new TransactionInstruction({
      keys: [
        {
          pubkey: keypair.publicKey,
          isSigner: true,
          isWritable: true
        },
        {
          pubkey: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
          isSigner: false,
          isWritable: true
        }
      ],
      programId: new PublicKey('11111111111111111111111111111111'),
      data: tempList
    } as any)
    transaction.add(tempData)
  }

  const recentBlockhash = await web3Store.getBlockHash()
  transaction.recentBlockhash = recentBlockhash.blockhash
  transaction.feePayer = keypair.publicKey // 设置支付手续费的地址（通常为发起者钱包）

  // 使用钱包签名交易
  transaction.sign(keypair)
  return transaction
}

// 发起交易
const sendTransition = async () => {
  // 开始交易
  transQuery.totalTransStatus = 1
  // Step 1: 获取代币信息
  if (!transQuery.fromAddress || !transQuery.getAddress) return alert('请选择交易代币')
  let transType = 1 // 1买 2卖
  let transCoin = {} as any // 获取交易币信息
  try {
    if (transQuery.getAddress === solanaTokenAddress) {
      transType = 2
      transCoin = await getPumpTokenInfoByAddress({ mint: transQuery.fromAddress })
    } else {
      transCoin = await getPumpTokenInfoByAddress({ mint: transQuery.getAddress })
    }
  } catch (error) {
    alert('获取代币信息异常')
    return
  }

  // Step 2: 设置参数
  let solAmount = 0 // 交易数量
  if (!transQuery.transactionNum && (!transQuery.transactionRandomMax || !transQuery.transactionRandomMin || !transQuery.transactionRandomDecimal)) {
    return alert('请输入交易数量')
  }
  // 固定交易金额
  if (transQuery.transactionType === 1) {
    solAmount = +transQuery.transactionNum
  }
  // 随机交易金额
  else {
    solAmount = +generateRandomNumber(+transQuery.transactionRandomMin, +transQuery.transactionRandomMax, +transQuery.transactionRandomDecimal)
  }
  solAmount = solAmount * LAMPORTS_PER_SOL
  const mint = transCoin.mint // 交易的目标代币地址
  const curve = transCoin.bonding_curve // 交易的目标代币 curve 地址
  const ata = transCoin.associated_bonding_curve // 交易的目标代币 ata 地址
  const slip = Math.floor(+transQuery.slip * 100) // 整数  滑点 以千之一 计算的，如我要设置滑点为0.5% 这里就传入50 （相当于 0.5% * 1000）
  // 将交易账户按照并发量进行切割
  const tranAccountList = chunkArray(privateKeyList.value, +transQuery.concurrency)
  let delayTime = 0.1 // 交易时间间隔 单位秒
  if (!((!transQuery.timeNum && transQuery.timeType === 1) || ((!transQuery.timeRandomMin || !transQuery.timeRandomMax) && transQuery.timeType === 2))) {
    // 固定时间间隔
    if (transQuery.timeType === 1) {
      delayTime = +transQuery.timeNum
    }
    // 随机时间间隔
    else {
      delayTime = +generateRandomNumber(+transQuery.timeRandomMin, +transQuery.timeRandomMax, 2)
    }
  }

  // Step 3: 获取交易对象
  for (let index = 0; index < tranAccountList.length; index++) {
    // 人为中止交易
    if (!transQuery.totalTransStatus) {
      break
    }
    const tempList = tranAccountList[index]
    for (let nextIndex = 0; nextIndex < tempList.length; nextIndex++) {
      // 私钥
      const transPrivateKey = tempList[nextIndex]
      // 公钥
      const transPublicKey = web3Store.getPublicKeyFromPrivateKey(transPrivateKey)
      // 获取交易对象
      const transactionBase64 = await fetchTransaction(transType, transPublicKey, solAmount, mint, curve, ata, slip)
      if (!transactionBase64.instructions) {
        console.error('交易对象获取失败', transactionBase64)
        break
      }

      // Step 4: 签名交易
      const signedTransaction = await signTransactionWithPhantom(transactionBase64.instructions, transPublicKey, transPrivateKey)
      console.log('交易签名对象:', signedTransaction)

      // Step 5: 使用 JitoRpc 发送交易
      // 序列化签名交易为字节流
      const serializedTransaction = signedTransaction.serialize()
      // 将序列化的交易转换为 Base58 格式，用于发送到网络
      const base58Transaction = bs58.encode(serializedTransaction)
      try {
        const res = (await jitoSendTranstion({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [base58Transaction]
        })) as any
        // 发起交易成功
        checkTransitionStatus(res.result, transPublicKey)
        console.log('发起交易结果', res)
      } catch (error) {
        // 交易发起失败
        checkTransitionStatus('', transPublicKey)
      }
    }
    // 延迟等待
    await delayCall(delayTime * 1000)
  }

  // 交易结束
  transQuery.totalTransStatus = 0
}

// 交易上链，根据交易哈希去查询交易状态
const checkTransitionStatus = async (signature: string, publicKey: string) => {
  let count = 1
  transLog.value.unshift({
    address: publicKey, // 交易代币地址
    hash: signature, // 交易签名
    status: signature ? 1 : 2, // 日志状态 1发起交易成功 2发起交易失败 3正在等待交易确认 4交易确认完成 5交易确认失败 6五秒内无法确认交易
    time: Date.now()
  })

  // 轮询并确认交易
  let status = await web3Store.connection.getSignatureStatus(signature)
  while ((status.value === null || !status.value.confirmationStatus) && count < 5) {
    if (count === 1) {
      transLog.value.unshift({
        address: publicKey,
        hash: signature,
        status: 3,
        time: Date.now()
      })
    }
    count += 1
    await delayCall(1000) // 等待 1 秒
    status = await web3Store.connection.getSignatureStatus(signature)
  }

  // 没有获取到交易状态
  if (status.value === null || !status.value.confirmationStatus) {
    transLog.value.unshift({
      address: publicKey,
      hash: signature,
      status: 6,
      time: Date.now()
    })
  } else {
    // 交易已确认
    transLog.value.unshift({
      address: publicKey,
      hash: signature,
      status: status.value?.confirmationStatus === 'confirmed' ? 4 : 5,
      time: Date.now()
    })
  }
  console.log('交易状态:', status, publicKey, signature)
}

// 暂停交易
const stopTransition = () => {
  transQuery.totalTransStatus = 0
}
</script>

<template>
  <div>
    <div class="public-header"></div>

    <div class="pubulic-content">
      <!---left-->
      <div class="left-menu">
        <div class="logo"><img src="/public/images/sider-logo.png" class="logoimg" /></div>
      </div>

      <!---right-->
      <div class="right-content">
        <!---sticky header-->
        <div class="right-top-header"></div>

        <!---content-->
        <div class="public-width-auto">
          <div class="to-more-head public">
            <div class="title">批量交易</div>
            <div class="title-small">預設並自動執行交易指令，輕鬆實現批量在DEX交易，提高了交易的效率和時效性，特別適用於快速執行大量交易的場景</div>
          </div>

          <div class="grid-width">
            <div class="grid-left-content">
              <div class="grid-card px-24 py-24 mb-16 overdiv-box">
                <h3 class="public-small-h3-title">用戶概覽</h3>
                <h4>總地址數量: -</h4>
                <div class="flex row-between pb-24 border">
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                </div>

                <h4>啟用帳戶數量: -</h4>
                <div class="flex row-between pb-24">
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                  <div class="flex row-column">
                    <p>SOL餘額</p>
                    <p>-</p>
                  </div>
                </div>
              </div>

              <div class="grid-card px-24 py-24 mb-16">
                <h3 class="public-small-h3-title mb-8">批量交易設置</h3>
                <div class="relative">
                  <div class="mb-16">
                    <p class="mb-10">從</p>
                    <input type="text" class="public-input" placeholder="请连接钱包" />
                  </div>

                  <div class="changeimg-zhuah"></div>

                  <div class="mb-16">
                    <p class="mb-10">到</p>
                    <input type="text" class="public-input" placeholder="请连接钱包" />
                  </div>
                </div>

                <div class="mb-16 flex row-between">
                  DEX:
                  <div class="flex">
                    <div class="public-button-three active">Raydium</div>
                    <div class="public-button-three">PumpFun</div>
                    <div class="public-button-three">MoonShot</div>
                  </div>
                </div>
                <div class="public-button-two">查找流動性池</div>
              </div>
            </div>

            <div class="grid-right-content">
              <div class="mb-40 border py-16">
                <div class="public-button active mr-16">導入批量交易錢包</div>
                <div class="public-button">查詢餘額</div>
              </div>

              <template v-if="!web3Store.publicAddress">
                <div class="mt-3 mb-1.5">链接钱包</div>
                <button class="bg-gray-200 w-16 h-8 rounded-md" @click="connectWallet">连接</button>
              </template>
              <template v-else>
                <div class="">用户钱包地址：{{ web3Store.publicAddress }}</div>

                <div class="py-100 mt-5 mb-1.5">请导入钱包</div>
                <textarea
                  v-model="privateKeyText"
                  placeholder="请输入钱包地址，一行一个"
                  rows="4"
                  class="w-full border-solid border-1 border-gray-300"
                  @input="splitAddress"
                />

                <div class="py-100 mt-5 mb-1">交易代币地址</div>
                <div class="flex items-center">
                  <span>从：</span>
                  <select
                    class="w-full h-10 border-1 border-gray-200 border-solid rounded-md mt-2"
                    v-model="transQuery.fromAddress"
                    @change="changeSwampAddress(1)"
                  >
                    <option v-for="item in web3Store.userPupmTokens" :key="item.mint" :name="item.mint">{{ item.mint }}</option>
                  </select>
                </div>
                <div class="flex items-center">
                  <span>到：</span>
                  <select
                    class="w-full h-10 border-1 border-gray-200 border-solid rounded-md mt-2"
                    v-model="transQuery.getAddress"
                    @change="changeSwampAddress(2)"
                  >
                    <option v-for="item in web3Store.userPupmTokens" :key="item.mint" :name="item.mint">{{ item.mint }}</option>
                  </select>
                </div>
                <div class="py-100 mt-5 mb-1">并发量</div>
                <input type="text" v-model="transQuery.concurrency" class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300" />

                <div class="py-100 mt-5 mb-1">单次买卖金额</div>
                <div class="flex">
                  <button
                    :class="['bg-gray-200 w-16 h-8 rounded-md', transQuery.transactionType === 1 && 'bg-blue-800 text-white']"
                    @click="transQuery.transactionType = 1"
                  >
                    固定金额
                  </button>
                  <button
                    :class="['bg-gray-200 w-16 h-8 rounded-md ml-4', transQuery.transactionType === 2 && 'bg-blue-800 text-white']"
                    @click="transQuery.transactionType = 2"
                  >
                    随机
                  </button>
                </div>
                <input
                  v-if="transQuery.transactionType === 1"
                  type="text"
                  v-model="transQuery.transactionNum"
                  class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300 mt-2"
                />
                <div v-else class="flex items-center mt-2">
                  <input
                    type="text"
                    v-model="transQuery.transactionRandomMin"
                    placeholder="随机最小值"
                    class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300"
                  />
                  <span class="flex items-center px-5">~</span>
                  <input
                    type="text"
                    v-model="transQuery.transactionRandomMax"
                    placeholder="随机最大值"
                    class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300"
                  />
                  <span class="flex w-10"></span>
                  <input
                    type="text"
                    v-model="transQuery.transactionRandomDecimal"
                    placeholder="随机小数"
                    class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300"
                  />
                </div>

                <div class="py-100 mt-5 mb-1">jito加速小费[SOL]</div>
                <input type="text" v-model="transQuery.jtoFree" class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300" />

                <div class="py-100 mt-5 mb-1">滑点设置[%]</div>
                <input type="text" v-model="transQuery.slip" class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300" />

                <div class="py-100 mt-5 mb-1">时间间隔[秒]</div>
                <div class="flex">
                  <button :class="['bg-gray-200 w-16 h-8 rounded-md', transQuery.timeType === 1 && 'bg-blue-800 text-white']" @click="transQuery.timeType = 1">
                    固定
                  </button>
                  <button
                    :class="['bg-gray-200 w-16 h-8 rounded-md ml-4', transQuery.timeType === 2 && 'bg-blue-800 text-white']"
                    @click="transQuery.timeType = 2"
                  >
                    随机
                  </button>
                </div>
                <input
                  v-if="transQuery.timeType === 1"
                  type="text"
                  v-model="transQuery.timeNum"
                  class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300 mt-2"
                />
                <div v-else class="flex items-center mt-2">
                  <input
                    type="text"
                    v-model="transQuery.timeRandomMin"
                    placeholder="随机最小值"
                    class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300"
                  />
                  <span class="flex items-center px-5">~</span>
                  <input
                    type="text"
                    v-model="transQuery.timeRandomMax"
                    placeholder="随机最大值"
                    class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300"
                  />
                </div>

                <!-- <div class="py-100 mt-5 mb-1">总次数</div>
                <input type="text" v-model="transQuery.totalTimes" class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300" />

                <div class="py-100 mt-5 mb-1">总时间[秒]</div>
                <input type="text" v-model="transQuery.totalDuration" class="w-full h-8 rounded px-2 border-solid border-1 border-gray-300" /> -->

                <div class="flex items-center justify-center mt-30">
                  <button v-if="!transQuery.totalTransStatus" :class="['bg-green-600 text-white font-bold w-20 h-8 rounded-md']" @click="sendTransition">
                    开始交易
                  </button>
                  <button v-else class="bg-red-600 text-white font-bold w-20 h-8 rounded-md ml-10" @click="stopTransition">停止交易</button>
                </div>
              </template>
            </div>
          </div>

          <div class="grid-width">
            <div class="grid-left-content">
              <div class="grid-card px-24 py-24 mb-16">
                <h3 class="public-small-h3-title">交易參數設置</h3>
                <div class="form-item">
                  <div class="form-item-title">
                    <div class="label-title">
                      <div>交易數量</div>
                    </div>
                  </div>
                  <div class="flex">
                    <div class="mr-8 flex">
                      <input type="radio" checked />
                      <label>全部金額</label>
                    </div>

                    <div class="mr-8 flex">
                      <input type="radio" />
                      <label>固定金額</label>
                    </div>

                    <div class="mr-8 flex">
                      <input type="radio" />
                      <label>隨機金額</label>
                    </div>

                    <div class="mr-8 flex">
                      <input type="radio" />
                      <label>隨機百分比</label>
                    </div>
                  </div>
                </div>

                <div class="form-item">
                  <div class="form-item-title">
                    <div class="label-title">
                      <b>任務執行間隔(秒)</b>
                      <div>
                        <input type="checkbox" class="public-checkbox mr-8" />
                        <span>隨機</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <input type="text" class="public-input" value="0.1" placeholder="" />
                  </div>
                </div>

                <div class="form-item">
                  <div class="form-item-title">
                    <div class="label-title">
                      <b>滑點設置</b>
                    </div>
                  </div>
                  <div class="flex">
                    <div className="num-content flex-1 mr-16">
                      <ul>
                        <li>自动</li>
                        <li>0.3%</li>
                        <li>0.5%</li>
                        <li className="active">1.0%</li>
                        <li>3.0%</li>
                      </ul>
                    </div>
                    <div class="flex row-middle">
                      <input type="text" class="public-input mr-8" value="0.1" placeholder="" style="width: 100px" />
                      <span>%</span>
                    </div>
                  </div>
                </div>

                <div class="form-item">
                  <div class="form-item-title">
                    <div class="label-title">
                      <b>Jito MEV小費</b>
                    </div>
                  </div>
                  <div class="flex">
                    <div className="num-content flex-1 mr-16">
                      <ul>
                        <li>0</li>
                        <li>默認0.00003</li>
                        <li>高速0.0001</li>
                        <li className="active">極速0.0003</li>
                      </ul>
                    </div>
                    <div class="flex row-middle">
                      <input type="text" class="public-input mr-8" value="0.1" placeholder="" style="width: 100px" />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid-right-content">
              <div class="py-100">交易日誌</div>
              <div v-for="item in transLog" :key="item.time" class="w-full h-auto px-20 py-20 mb-3 border-gray-200 border-solid border-2 rounded">
                <div>钱包地址：{{ item.address }}</div>
                <div>交易签名：{{ item.hash || '' }}</div>
                <div>
                  交易状态：{{
                    (
                      {
                        1: '发起交易成功',
                        2: '发起交易失败',
                        3: '正在等待交易确认',
                        4: '交易确认完成',
                        5: '交易确认失败',
                        6: '交易状态查询失败，请到官网查询'
                      } as any
                    )[item.status] || '未知'
                  }}
                </div>
                <div>查询时间：{{ timeString(item.time) }}</div>
              </div>
            </div>
          </div>

          <div class="pt-16">
            <div class="public-tishi">
              建議啟用自動滑點設置。若滑點設置過低、餘額、GAS不足或鏈上擁堵，DEX路由可能出現處理錯誤。遇到此類情況，請增加Jito小費並重試。
            </div>
          </div>

          <div class="mt-40 mb-30">
            <button class="public-button-sbmit">
              <span>開始批量交易</span>
            </button>
          </div>

          <div class="get-fee"><span>全網最低，每批次交易只需要0.008SOL</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.yellow-tips {
  color: #ff9815;
  font-family: PingFang SC;
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
  margin-top: 10px;
  font-weight: bold;
}

.get-fee {
  color: #000;
  display: flex;
  font-size: 12px;
  justify-content: center;
  margin-top: 10px;
}

.overdiv-box {
  height: 295px;

  h3 {
    color: #000;
    font-size: 16px;
    font-weight: normal;
    height: 22px;
    line-height: 22px;
    margin-bottom: 24px;
  }

  h4 {
    color: #000;
    font-size: 14px;
    font-weight: normal;
    height: 20px;
    line-height: 20px;
    margin-bottom: 16px;
    margin-top: 16px;
  }
}

.changeimg-zhuah {
  background: url(/public/images/zhuanhuan.svg) no-repeat 0 0;
  background-size: 100% 100%;
  height: 32px;
  left: 50%;
  position: absolute;
  top: 91px;
  transform: translateX(-50%);
  width: 32px;
  z-index: 99;
}
</style>
