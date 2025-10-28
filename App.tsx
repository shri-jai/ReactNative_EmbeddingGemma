import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Alert } from 'react-native';
import * as ort from 'onnxruntime-react-native';
import { keepLocalCopy, pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import now from 'performance-now';

type ChunkItem = {
  id: string;
  text: string;
  tokens: number[];
  attention_mask: number[];
  embedding?: number[];
};

type ScoredChunk = {
  index: number;
  score: number;
  text: string;
};

const HelloWorks = () => {
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState('');
  const [modelPath, setModelPath] = useState<string>('');
  const [metrics, setMetrics] = useState<any>({});
  const [jsonPath, setJsonPath] = useState<string>('');
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [embeddingProcessing, setEmbeddingProcessing] = useState(false);

  const fetchJsonFromAPI = async () => {
    try {
      console.log(`Inside fetech Json Api function`);
      if (!textInput) {
        Alert.alert('Enter input text first');
        return;
      }

      const url = `http://192.168.68.184:8080/process_pdf?pdf_path=${encodeURIComponent(
        textInput,
      )}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.status}`);
      console.log('After the fetech json link');
      const data: ChunkItem[] = await res.json();

      const localPath = `${RNFS.DocumentDirectoryPath}/kb_chunks.json`;
      await RNFS.writeFile(localPath, JSON.stringify(data, null, 2), 'utf8');

      setJsonPath(localPath);
      setChunks(data);
      console.log(`Json file fetched and saved locally`);
      Alert.alert(
        'JSON KB fetched and stored locally',
        `Found ${data.length} chunks`,
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error fetching JSON KB', String(err));
    }
  };

  let internalSession: ort.InferenceSession | null = null;
  const exportJsonToDownloads = async () => {
    try {
      const src = `${RNFS.DocumentDirectoryPath}/kb_chunks.json`;
      const dest = `${RNFS.DownloadDirectoryPath}/kb_chunks.json`;
      await RNFS.copyFile(src, dest);
      console.log('File copied to:', dest);
      Alert.alert('File exported!', `Saved to Downloads: kb_chunks.json`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error exporting file', String(err));
    }
  };
  const handleUploadModel = async (): Promise<void> => {
    try {
      console.log(`Inside handle upload model function!`);
      const modelFileName = 'model.onnx';
      const modelPathLocal = `${RNFS.DocumentDirectoryPath}/${modelFileName}`;

      const exists = await RNFS.exists(modelPathLocal);
      if (!exists) await RNFS.copyFileAssets(modelFileName, modelPathLocal);

      setModelPath(modelPathLocal);

      const res = await pick();
      const file = res[0];
      if (!file.name || !file.name.endsWith('.onnx_data')) {
        Alert.alert('Invalid file', 'Select the correct .onnx_data file');
        return;
      }

      const dataPath = `${RNFS.DocumentDirectoryPath}/model.onnx_data`;
      await RNFS.copyFile(file.uri, dataPath);
      console.log(`Model file copied successfully!`);
      const info = await RNFS.stat(modelPathLocal);
      setMetrics((m: any) => ({
        ...m,
        modelSizeMB: info.size / (1024 * 1024),
      }));

      Alert.alert('Model onnx data copied');
    } catch (e: any) {
      Alert.alert('Failed to load model', e.message ?? String(e));
      console.log(e);
    }
  };

  const handleLoadModel = async () => {
    console.log(`Inside handle load model`);
    if (!modelPath) {
      Alert.alert('Upload model first');
      return;
    }
    try {
      internalSession = await ort.InferenceSession.create(
        `file://${modelPath}`,
      );
      setSession(internalSession);
      console.log(`Model loaded successfully!`);
      console.log(
        'Model loaded. Input Names:',
        internalSession.inputNames,
        'Output Names:',
        internalSession.outputNames,
      );
      Alert.alert(
        'Model loaded',
        `Input Names: ${internalSession.inputNames} Output Names: ${internalSession.outputNames}`,
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load ONNX model');
    }
  };

  const embedChunks = async () => {
    console.log(`Inside Embed Chunks`);
    if (!session || !jsonPath || !chunks.length) {
      Alert.alert('Load model and JSON first');
      return;
    }

    setEmbeddingProcessing(true);
    try {
      await RNFS.writeFile(jsonPath, '[', 'utf8');

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const inputIdsTensor = new ort.Tensor(
          'int64',
          BigInt64Array.from(chunk.tokens.map(BigInt)),
          [1, chunk.tokens.length],
        );
        const attentionMaskTensor = new ort.Tensor(
          'int64',
          BigInt64Array.from(chunk.attention_mask.map(BigInt)),
          [1, chunk.attention_mask.length],
        );
        console.log(`This is before the model run`);
        const output = await session.run({
          input_ids: inputIdsTensor,
          attention_mask: attentionMaskTensor,
        });
        console.log(`This is the after the model run`);

        const embeddingTensor = output[session.outputNames[1]];
        chunk.embedding = Array.from(
          embeddingTensor.data as Float32Array,
        ) as number[];

        const jsonChunk = JSON.stringify(chunk, null, 2);

        if (i > 0) {
          await RNFS.appendFile(jsonPath, ',\n', 'utf8');
        }
        await RNFS.appendFile(jsonPath, jsonChunk, 'utf8');

        if ((i + 1) % 5 === 0) console.log(`Embedded ${i + 1} chunks`);
      }
      console.log(`This is before append file`);
      await RNFS.appendFile(jsonPath, ']', 'utf8');
      console.log(`This is after append file`);

      console.log('Embedding complete, saved in JSON');
      Alert.alert('Embedding complete, saved in JSON');

      setChunks(chunks);

      console.log(
        'First two embeddings:',
        chunks[0].embedding,
        chunks[1].embedding,
      );
    } catch (err) {
      console.error(err);
      Alert.alert(`Error embedding KB: ${err}`);
    } finally {
      setEmbeddingProcessing(false);
    }
  };
  const queryTopChunks = async () => {
    try {
      if (!session || !jsonPath) {
        Alert.alert('Load model and JSON first');
        return;
      }
      if (!textInput) {
        Alert.alert('Enter a query text');
        return;
      }

      console.log('semantic searching...');

      const jsonContent = await RNFS.readFile(jsonPath, 'utf8');
      const chunksData = JSON.parse(jsonContent);

      const tokenRes = await fetch(
        `http://192.168.68.184:8080/tokenization?text=${encodeURIComponent(
          textInput,
        )}`,
        { method: 'POST' },
      );
      console.log(`after query tokenization`);
      const tokenData = await tokenRes.json();
      console.log("query's tokenData:", tokenData);

      const inputIdsTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(tokenData.input_ids.map(BigInt)),
        [1, tokenData.input_ids.length],
      );
      console.log(`after inputids tensor`);
      const attentionMaskTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(tokenData.attention_mask.map(BigInt)),
        [1, tokenData.attention_mask.length],
      );

      console.log(`after attentionmask tensor`);

      const output = await session.run({
        input_ids: inputIdsTensor,
        attention_mask: attentionMaskTensor,
      });

      const queryEmbedding = Array.from(
        output['sentence_embedding'].data as Float32Array,
      );
      console.log(`After query embedding`);
      // Step 3: Compute cosine similarity for all chunks
      const cosineSimilarity = (a: number[], b: number[]) => {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (magA * magB);
      };

      const scoredChunks: ScoredChunk[] = chunksData
        .filter((chunk: ChunkItem) => chunk.embedding)
        .map((chunk: ChunkItem, idx: number) => ({
          index: idx,
          score: cosineSimilarity(queryEmbedding, chunk.embedding!),
          text: chunk.text,
        }));

      const topChunks = scoredChunks
        .sort((a: ScoredChunk, b: ScoredChunk) => b.score - a.score)
        .slice(0, 3);

      console.log('Top 3 Retrieved Chunks:');
      topChunks.forEach(
        (chunk: { index: number; score: number; text: string }, i: number) => {
          console.log(
            `#${chunk.index} | Score: ${chunk.score.toFixed(
              4,
            )} | Text Chunk: ${chunk.text.slice(0, 1500)}`,
          );
        },
      );

      Alert.alert(
        'Top 3 Matches',
        topChunks
          .map(
            (c: { index: number; score: number }) =>
              `Chunk #${c.index} (${c.score.toFixed(3)})`,
          )
          .join('\n'),
      );
    } catch (err) {
      console.error('Error during semantic search:', err);
      Alert.alert('Search Error', String(err));
    }
  };

  return (
    <View style={styles.baseLine}>
      <Text>Enter the Text that you want to search in the corpus.: </Text>
      <TextInput
        style={styles.inputBox1}
        placeholder="Any text you want to search"
        value={textInput}
        onChangeText={setTextInput}
      />

      <Button title="Upload Model onnx_data" onPress={handleUploadModel} />
      <Button title="Load Model" onPress={handleLoadModel} />

      <Button title="Fetch JSON File" onPress={fetchJsonFromAPI} />
      <Button title="Embed KB" onPress={embedChunks} />
      <Button title="Store json locally" onPress={exportJsonToDownloads} />
      <Button title="Search" onPress={queryTopChunks} />
      {embeddingProcessing && (
        <Text style={{ marginTop: 10, color: 'yellow' }}>
          ⏳ Embedding in progress...
        </Text>
      )}

      <Text> {result}</Text>
      <View style={{ marginTop: 20 }}>
        <Text style={{ color: 'white' }}>📈 Metrics:</Text>
        {Object.entries(metrics).map(([k, v]) => (
          <Text key={k} style={{ color: 'white' }}>
            {k}: {typeof v === 'number' ? v.toFixed(2) : String(v)}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  baseLine: {
    flex: 1,
    backgroundColor: 'grey',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox1: {
    borderWidth: 1,
    borderColor: 'cyan',
  },
});

export default HelloWorks;
