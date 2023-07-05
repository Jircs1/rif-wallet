import { useNavigation } from '@react-navigation/core'
import WalletConnect from '@walletconnect/client'
import {
  useEffect,
  useState,
  createContext,
  ReactElement,
  useCallback,
} from 'react'
import { RIFWallet } from '@rsksmart/rif-wallet-core'
import { WalletConnectAdapter } from '@rsksmart/rif-wallet-adapters'

import {
  deleteWCSession,
  getWCSession,
  IWCSession,
  saveWCSession,
} from 'storage/WalletConnectSessionStore'
import { useAppSelector } from 'store/storeUtils'
import { selectWallets } from 'store/slices/settingsSlice'

export interface WalletConnectContextInterface {
  connections: IWalletConnectConnections
  createSession: (wallet: RIFWallet, uri: string, session?: IWCSession) => void
  handleApprove: (wc: WalletConnect, wallet: RIFWallet | null) => Promise<void>
  handleReject: (wc: WalletConnect) => void
}

export const WalletConnectContext =
  createContext<WalletConnectContextInterface>({
    connections: {},
    createSession: () => {},
    handleApprove: async () => {},
    handleReject: () => {},
  })

export interface IWalletConnectConnections {
  [key: string]: {
    connector: WalletConnect
    address: string
  }
}

interface Props {
  children: ReactElement
}

export const WalletConnectProviderElement = ({ children }: Props) => {
  const navigation = useNavigation()

  const [connections, setConnections] = useState<IWalletConnectConnections>({})

  const wallets = useAppSelector(selectWallets)

  const unsubscribeToEvents = async (wc: WalletConnect) => {
    const eventsNames = [
      'session_request',
      'session_update',
      'call_request',
      'connect',
      'disconnect',
    ]

    eventsNames.forEach(x => wc.off(x))
  }

  const subscribeToEvents = useCallback(
    async (wc: WalletConnect, adapter: WalletConnectAdapter) => {
      await unsubscribeToEvents(wc)
      wc.on('session_request', async (error, payload) => {
        console.log({
          1: 'EVENT: 69',
          2: 'session_request',
          3: error,
          4: payload,
        })

        if (error) {
          throw error
        }

        navigation.navigate(
          'WalletConnect' as never,
          { wcKey: wc.key } as never,
        )
      })
      wc.on('call_request', async (error, payload) => {
        console.log({ 1: 'EVENT: 82', 2: 'call_request', 3: error, 4: payload })
        if (error) {
          throw error
        }
        if (!adapter) {
          throw new Error('Missing adapter')
        }

        const { id, method, params } = payload

        adapter
          .handleCall(method, params)
          .then(result => wc.approveRequest({ id, result }))
          .catch((errorReason: string) =>
            wc.rejectRequest({ id, error: { message: errorReason } }),
          )
      })
      wc.on('disconnect', async error => {
        console.log('EVENT: 100', 'disconnect', error)
        if (error) {
          throw error
        }

        await unsubscribeToEvents(wc)
        deleteWCSession(wc.uri)
        setConnections(prev => {
          const result = { ...prev }
          delete result[wc.key]
          return result
        })
      })
    },
    [navigation],
  )
  const handleApprove = async (wc: WalletConnect, wallet: RIFWallet | null) => {
    try {
      if (wc && wallet) {
        wc.approveSession({
          accounts: [wallet.smartWalletAddress],
          chainId: await wallet.getChainId(),
        })
        saveWCSession({
          key: wc.key,
          uri: wc.uri,
          session: wc.session,
          walletAddress: wallet.address,
        })
        const adapter = new WalletConnectAdapter(wallet)
        await subscribeToEvents(wc, adapter)
        setConnections(prev => ({
          ...prev,
          [wc.key]: {
            connector: wc,
            address: wallet.address,
          },
        }))
      }
    } catch (err) {
      console.log(143, err)
    }
  }

  const handleReject = (wc: WalletConnect) => {
    if (wc) {
      wc.rejectSession({ message: 'user rejected the session' })
    }
  }

  const createSession = useCallback(
    (wallet: RIFWallet, uri: string, session?: IWCSession) => {
      try {
        const newConnector = new WalletConnect({
          uri,
          session,
          clientMeta: {
            description: 'RIF Wallet',
            url: 'https://www.rifos.org/',
            icons: [
              'https://raw.githubusercontent.com/rsksmart/rif-scheduler-ui/develop/src/assets/logoColor.svg',
            ],
            name: 'RIF Wallet',
          },
        })
        const adapter = new WalletConnectAdapter(wallet)

        // needs to subscribe to events before createSession
        // this is because we need the 'session_request' event
        subscribeToEvents(newConnector, adapter)

        setConnections(prev => ({
          ...prev,
          [newConnector.key]: {
            connector: newConnector,
            address: wallet.address,
          },
        }))
      } catch (error) {
        console.error(error)
      }
    },
    [subscribeToEvents],
  )
  useEffect(() => {
    const reconnectWCSession = async () => {
      const storedSessions = getWCSession()
      if (!storedSessions) {
        return
      }

      const sessions = Object.values(storedSessions)

      for (const { walletAddress, uri, session } of sessions) {
        try {
          const wallet = wallets ? wallets[walletAddress] : null
          if (wallet) {
            createSession(wallet, uri, session)
          }
        } catch (error) {
          console.error('reconnect wc error: ', error)
          deleteWCSession(uri)
        }
      }
    }
    if (wallets) {
      reconnectWCSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets])

  const initialContext: WalletConnectContextInterface = {
    connections,
    createSession,
    handleApprove,
    handleReject,
  }

  return (
    <WalletConnectContext.Provider value={initialContext}>
      {children}
    </WalletConnectContext.Provider>
  )
}
