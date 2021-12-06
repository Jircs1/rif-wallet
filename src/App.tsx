import './shim'
import '@ethersproject/shims' // ref: https://docs.ethers.io/v5/cookbook/react-native/#cookbook-reactnative
import 'react-native-gesture-handler'
import 'react-native-get-random-values'

import React, { useEffect, useState } from 'react'
import { AppState, SafeAreaView, StatusBar, View } from 'react-native'

import { Wallets, Requests } from './Context'
import { RootNavigation } from './RootNavigation'
import ModalComponent from './ux/requestsModal/ModalComponent'

import { Wallet } from '@ethersproject/wallet'
import { KeyManagementSystem, OnRequest, RIFWallet } from './lib/core'
import { getKeys, hasKeys, saveKeys, deleteKeys } from './storage/KeyStore'
import { jsonRpcProvider } from './lib/jsonRpcProvider'
import { i18nInit } from './lib/i18n'
import { Loading } from './components'
import { AppContext } from './Context'
import { RifWalletServicesFetcher } from './lib/rifWalletServices/RifWalletServicesFetcher'
import { AbiEnhancer } from './lib/abiEnhancer/AbiEnhancer'
import Resolver from '@rsksmart/rns-resolver.js'

import { Cover } from './components/cover'
import { RequestPIN } from './components/requestPin'
import { hasPin } from './storage/PinStore'

const createRIFWalletFactory = (onRequest: OnRequest) => (wallet: Wallet) =>
  RIFWallet.create(
    wallet.connect(jsonRpcProvider),
    '0x3f71ce7bd7912bf3b362fd76dd34fa2f017b6388',
    onRequest,
  ) // temp - using only testnet

const fetcher = new RifWalletServicesFetcher()
const abiEnhancer = new AbiEnhancer()
// @ts-ignore
const rnsResolver = new Resolver.forRskTestnet()

const App = () => {
  const [appState, setAppState] = useState<
    'LOADING' | 'BACKGROUND' | 'LOCKED' | 'READY'
  >('LOADING')

  const [kms, setKMS] = useState<null | KeyManagementSystem>(null)
  const [wallets, setWallets] = useState<Wallets>({})
  const [requests, setRequests] = useState<Requests>([])
  const [selectedWallet, setSelectedWallet] = useState('')

  const onRequest: OnRequest = request => setRequests([request])
  const createRIFWallet = createRIFWalletFactory(onRequest)

  const setKeys = (newKms: KeyManagementSystem, newWallets: Wallets) => {
    setWallets(newWallets)
    setSelectedWallet(newWallets[Object.keys(newWallets)[0]].address) // temp - using only one wallet
    setKMS(newKms)
  }

  // TEMP TEMP
  const logUpdateState = (newState: any) => {
    console.log('state change:', newState)
    // @ts-ignore
    setAppState(newState)
  }

  const handleAppStateChange = (newState: string) => {
    if (newState !== 'active') {
      resetAppState()
      return logUpdateState('BACKGROUND')
    }

    appIsActive()
  }

  /**
   * App is active and ready to check if it has keys and has pin
   */
  const appIsActive = () => {
    logUpdateState('LOADING')

    hasKeys().then((walletHasKeys: boolean | null) => {
      if (!walletHasKeys) {
        // no keys, user should setup their wallet
        return logUpdateState('READY')
      }

      hasPin().then((walletHasPin: boolean | null) =>
        walletHasPin ? logUpdateState('LOCKED') : loadExistingWallets(),
      )
    })
  }

  useEffect(() => {
    i18nInit().finally(appIsActive)

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    )

    return () => {
      subscription.remove()
    }
  }, [])

  const loadExistingWallets = async () => {
    logUpdateState('LOADING')
    const serializedKeys = await getKeys()
    // eslint-disable-next-line no-shadow
    const { kms, wallets } = KeyManagementSystem.fromSerialized(serializedKeys!)

    const rifWallets = await Promise.all(wallets.map(createRIFWallet))

    const rifWalletsDictionary = rifWallets.reduce(
      (p: Wallets, c: RIFWallet) => Object.assign(p, { [c.address]: c }),
      {},
    )

    setKeys(kms, rifWalletsDictionary)
    setAppState('READY')
  }

  const createFirstWallet = async (mnemonic: string) => {
    // eslint-disable-next-line no-shadow
    const kms = KeyManagementSystem.import(mnemonic)
    const { save, wallet } = kms.nextWallet(31)

    const rifWallet = await createRIFWallet(wallet)

    save()
    const serialized = kms.serialize()
    await saveKeys(serialized)

    setKeys(kms, { [rifWallet.address]: rifWallet })

    return rifWallet
  }

  const resetAppState = () => {
    setKMS(null)
    setWallets({})
    setSelectedWallet('')
  }

  const closeRequest = () => setRequests([] as Requests)

  if (appState === 'LOADING') {
    return (
      <SafeAreaView>
        <Loading reason="Getting set..." />
      </SafeAreaView>
    )
  }

  if (appState === 'BACKGROUND') {
    return <Cover />
  }

  if (appState === 'LOCKED') {
    return (
      <SafeAreaView>
        <RequestPIN unlock={loadExistingWallets} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView>
      <StatusBar />
      <AppContext.Provider
        value={{
          wallets,
          selectedWallet,
          setRequests,
          mnemonic: kms?.mnemonic,
        }}>
        <RootNavigation
          keyManagementProps={{
            generateMnemonic: () => KeyManagementSystem.create().mnemonic,
            createFirstWallet,
          }}
          balancesScreenProps={{ fetcher }}
          sendScreenProps={{ rnsResolver }}
          activityScreenProps={{ fetcher, abiEnhancer }}
          keysInfoScreenProps={{
            mnemonic: kms?.mnemonic || '',
            deleteKeys,
          }}
        />

        {requests.length !== 0 && (
          <ModalComponent closeModal={closeRequest} request={requests[0]} />
        )}
      </AppContext.Provider>
    </SafeAreaView>
  )
}

export default App
