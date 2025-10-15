import React from 'react';
import { View, Text, TextInput, StyleSheet, Button, Alert } from 'react-native';
import * as ort from 'onnxruntime-react-native';
import { keepLocalCopy, pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import ReactNativeBlobUtil from 'react-native-blob-util';

const HelloWorks = () => {
  const [textInput, setText] = React.useState('');
  const [result, setResult] = React.useState('');
  const [modelPath, setModelPath] = React.useState<string>('');

  const pickModelFile = async () => {};

  let session: ort.InferenceSession | null = null;

  const handleUploadModel = async (): Promise<void> => {
    try {
      console.log('Entered the handleUploadmodel function');

      const modelFileName = 'model.onnx';
      const modelPath = `${RNFS.DocumentDirectoryPath}/${modelFileName}`;

      const exists = await RNFS.exists(modelPath);
      console.log(`.onnx exists: ${exists}`);
      if (!exists) {
        console.log(`Copying onnx from Android assets`);
        await RNFS.copyFileAssets(modelFileName, modelPath);
        console.log('onnx copied');
      }

      setModelPath(modelPath);
      console.log(`Model path set to state: ${modelPath}`);

      console.log('before file pick');
      const res = await pick();
      console.log('after file picked');
      const file = res[0];
      console.log(
        `File picked: uri=${file.uri}, name=${file.name}, size=${file.size}`,
      );

      if (!file.name || !file.name.endsWith('.onnx_data')) {
        Alert.alert('Invalid file', 'Select the correct .onnx_data file');
        return;
      }

      const dataPath = `${RNFS.DocumentDirectoryPath}/model.onnx_data`;
      console.log(`Copying onnx_data to ${dataPath}`);
      await RNFS.copyFile(file.uri, dataPath);
      console.log(`onnx_data copied`);

      console.log('Model loaded and input names accessed');
    } catch (e: any) {
      Alert.alert('Failed to load model', e.message ?? String(e));
      console.log(`Error caught in loadModel: ${e}`);
    }
  };

  const handleTokenization = async () => {
    console.log('Entered the onbutton click function!');
    try {
      const res = await fetch(
        `http://192.168.0.108:8080/tokenization?input_str=${encodeURIComponent(
          textInput,
        )}`,
      );
      const data = await res.json();
      // const data = '';
      console.log('after the fetch api', data);
      setResult(data.message);
      console.log(
        'next step onnx loading of the model embedding gemma ',
        modelPath,
      );
      const modelUri = `file://${modelPath}`;
      console.log(`Loading ONNX model, URI: ${modelUri} -`);
      session = await ort.InferenceSession.create(modelUri);
      console.log('Model loaded successfully!');

      Alert.alert(
        'Model loaded successfully',
        `Input names: ${session.inputNames.join(
          ', ',
        )}\nOutputs names: ${session.outputNames.join(', ')}`,
      );
    } catch (err) {
      console.error(err);
      setResult('Error Connecting to the server!');
    }
  };

  return (
    <View style={styles.baseLine}>
      <Text>Enter the Text that you want to search in the corpus.: </Text>
      <TextInput
        style={styles.inputBox1}
        placeholder="Any text you want to search"
        value={textInput}
        onChangeText={setText}
      ></TextInput>
      <Button title="Upload Model" onPress={handleUploadModel}></Button>
      <Button title="Enter" onPress={handleTokenization}></Button>
      <Text> {result}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  baseLine: {
    flex: 1,
    backgroundColor: 'grey',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox1: {
    borderWidth: 1,
    borderColor: 'cyan',
  },
});

export default HelloWorks;
