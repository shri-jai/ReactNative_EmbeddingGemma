import React from 'react';
import { View, Text, TextInput, StyleSheet, Button } from 'react-native';
import * as ort from 'onnxruntime-react-native';
import { keepLocalCopy, pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import ReactNativeBlobUtil from 'react-native-blob-util';

const HelloWorks = () => {
  const [textInput, setText] = React.useState('');
  const [result, setResult] = React.useState('');
  const [modelPath, setModelPath] = React.useState<string>('');

  const pickModelFile = async () => {};

  const handleUploadModel = async () => {
    try {
      const files = await pick();
      const file = files[0];
      console.log(`Selected file: ${file.uri}, Size: ${file.size}`);

      const [copyResult] = await keepLocalCopy({
        files: [
          {
            uri: file.uri,
            fileName: 'model.onnx',
          },
        ],
        destination: 'documentDirectory',
      });

      console.log(copyResult);
      if (copyResult.status === 'success') {
        console.log(
          `The position of the copied file is : ${copyResult.localUri}`,
        );
        setModelPath(copyResult.localUri);
      }

      // const destPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/model.onnx`;
      // console.log('the path in which the model resides is .: ', destPath);
      // console.log('the file[0].uri: ', file.uri);

      // const data = await ReactNativeBlobUtil.fs.readFile(file.uri, 'base64');
      // await ReactNativeBlobUtil.fs.writeFile(destPath, data, 'base64');

      // setModelPath(destPath);
      // console.log('the model path is : ', destPath);
    } catch (err) {
      console.log('Error occured :', err);
    }
  };

  const handleTokenization = async () => {
    console.log('Entered the onbutton click function.!');
    try {
      const res = await fetch(
        `http://192.168.68.184:8080/tokenization?input_str=${encodeURIComponent(
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
      const session: ort.InferenceSession = await ort.InferenceSession.create(
        modelPath,
        {},
      );
      console.log('Model loaded successfully!');
      console.log('Input names:', session.inputNames);
      const inputname = session.inputNames;
      console.log('The input names of the onnx model is : ', inputname);
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
