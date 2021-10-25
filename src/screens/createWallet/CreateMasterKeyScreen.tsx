import { NavigationProp, ParamListBase } from '@react-navigation/core'
import React, { useMemo } from 'react'
import { StyleSheet, View, ScrollView } from 'react-native'

import { Header2, Paragraph } from '../../components/typography'
import CopyComponent from '../../components/copy'

import Button from '../../components/button'
import { KeyManagementSystem } from '../../lib/core/KeyManagementSystem'

interface Interface {
  navigation: NavigationProp<ParamListBase>
  route: any
}

const CreateMasterKeyScreen: React.FC<Interface> = ({ navigation }) => {
  const mnemonic = useMemo(() => KeyManagementSystem.create().mnemonic, [])

  return (
    <ScrollView>
      <View style={styles.sectionCentered}>
        <Paragraph>
          With your master key (seed phrase) you are able to create as many
          wallets as you need.
        </Paragraph>
      </View>
      <View style={styles.sectionCentered}>
        <Paragraph>copy the key in a safe place ⎘</Paragraph>
      </View>
      <View style={styles.section}>
        <Header2>Master key</Header2>
        <CopyComponent value={mnemonic} testID={'Copy.Mnemonic'} />
      </View>
      <View style={styles.section}>
        <Button
          onPress={() => navigation.navigate('ConfirmMasterKey', { mnemonic })}
          title={'Next'}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  sectionCentered: {
    paddingTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    alignItems: 'center',
  },
})

export default CreateMasterKeyScreen
