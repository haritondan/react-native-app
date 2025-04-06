import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Text, View, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { colors } from '../config/constants';
import { auth, database } from '../config/firebase';
import ContactRow from '../components/ContactRow';
import Cell from '../components/Cell';

const availableLanguages = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'zh', label: 'Chinese' },
];

const Settings = ({ navigation }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchLanguage = async () => {
      const userDoc = await getDoc(doc(database, 'users', auth.currentUser.email));
      if (userDoc.exists()) {
        setSelectedLanguage(userDoc.data().language || 'en');
      }
    };
    fetchLanguage();
  }, []);

  const updateLanguage = async (languageCode) => {
    setSelectedLanguage(languageCode);
    await updateDoc(doc(database, 'users', auth.currentUser.email), { language: languageCode });
    setModalVisible(false);
  };

  return (
    <View>
      <ContactRow
        name={auth?.currentUser?.displayName ?? 'No name'}
        subtitle={auth?.currentUser?.email}
        style={styles.contactRow}
        onPress={() => {
          navigation.navigate('Profile');
        }}
      />

      <Cell
        title="Account"
        subtitle="Privacy, logout, delete account"
        icon="key-outline"
        onPress={() => {
          navigation.navigate('Account');
        }}
        iconColor="black"
        style={{ marginTop: 20 }}
      />

      <Cell
        title="Language"
        subtitle={`Current: ${availableLanguages.find((lang) => lang.code === selectedLanguage)?.label || 'English'}`}
        icon="globe-outline"
        iconColor="black"
        onPress={() => setModalVisible(true)}
      />

      <Cell
        title="Help"
        subtitle="Contact us, app info"
        icon="help-circle-outline"
        iconColor="black"
        onPress={() => {
          navigation.navigate('Help');
        }}
      />

      <Cell
        title="Invite a friend"
        icon="people-outline"
        iconColor="black"
        onPress={() => {
          alert('Share touched');
        }}
        showForwardIcon={false}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={availableLanguages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.languageOption}
                  onPress={() => updateLanguage(item.code)}
                >
                  <Text style={styles.languageText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    marginTop: 10,
  },
  closeText: {
    border: '1px solid black',
    color: 'red',
    fontSize: 16,
  },
  contactRow: {
    backgroundColor: 'white',
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  languageOption: {
    alignItems: 'center',
    padding: 10,
    width: '100%',
  },
  languageText: {
    fontSize: 16,
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'center',
  },
  modalContent: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

Settings.propTypes = {
  navigation: PropTypes.object.isRequired,
};

export default Settings;
