import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js'
import { SOLANA_MAIN_PATH, SPL_TOKEN_PROGRAM_ID } from '@/config'
import { getPumpTokenInfoByAddress } from '@/api/web3'
import bs58 from 'bs58'

export const useWeb3Store = defineStore('web3', () => {
  // 连接到 Solana 网络（这里是主网）
  const connection = new Connection(SOLANA_MAIN_PATH, 'confirmed')
  // 用户链接的钱包公钥地址
  const publicAddress = ref('')
  // 用户账户的代币列表
  const userPupmTokens = ref([] as any)
  // solana代币地址
  const solanaTokenAddress = ref('So11111111111111111111111111111111111111112')

  // 链接钱包
  async function connectWallet() {
    // @ts-ignore
    const { solana } = window

    if (solana && solana.isPhantom) {
      try {
        const response = await solana.connect()
        // 返回用户的公钥地址 base58
        publicAddress.value = response.publicKey.toString()
        // 差用用户可用代币列表
        fetchTokens(publicAddress.value)
      } catch (error) {
        console.log('请先登录Phantom钱包')
      }
    } else {
      console.log('请先安装Phantom钱包')
    }
  }

  // 获取代币账户信息
  async function fetchTokens(walletAddress: String) {
    const walletPublicKey = new PublicKey(walletAddress)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, { programId: new PublicKey(SPL_TOKEN_PROGRAM_ID) })

    // 解析代币账户数据
    const tokens = tokenAccounts.value
      .map(accountInfo => {
        const { mint, owner, tokenAmount } = accountInfo.account.data.parsed.info
        console.log('持币地址', mint)
        return {
          mint, // 代币合约地址
          owner, // 所有者地址
          amount: tokenAmount.uiAmount, // 代币数量（用户可读格式）
          decimals: tokenAmount.decimals // 代币精度
        }
      })
      .filter(k => k.mint.endsWith('pump'))
    const res = await Promise.all(tokens.map((k: any) => getPumpTokenInfoByAddress({ mint: k.mint })))
    userPupmTokens.value = res.map((k: any, index: number) => {
      return {
        ...tokens[index],
        ...k
      }
    })
    userPupmTokens.value.push({ mint: solanaTokenAddress.value })
    console.log('用户的可用代币地址', userPupmTokens.value)
  }

  // 根据Base58格式的私钥字符串获取公钥
  function getPublicKeyFromPrivateKey(base58PrivateKey: string) {
    if (!base58PrivateKey) return ''
    // 使用 bs58 解码 Base58 格式的私钥为 Uint8Array
    const secretKey = bs58.decode(base58PrivateKey)
    // 使用私钥生成密钥对
    const keypair = Keypair.fromSecretKey(secretKey)

    // 返回公钥的 Base58 编码
    return keypair.publicKey.toBase58()
  }

  // 获取块高度
  async function getBlockHash() {
    const recentBlockhash = await connection.getRecentBlockhash()
    return recentBlockhash
  }

  return { connection, solanaTokenAddress, publicAddress, connectWallet, userPupmTokens, fetchTokens, getPublicKeyFromPrivateKey, getBlockHash }
})
