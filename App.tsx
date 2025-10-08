// import React, { useEffect, useState } from 'react';
// import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
// import { AutoTokenizer, PreTrainedTokenizer } from '@xenova/transformers';

// const tokenizer = require('assets/tokenizer.json');

// const HomePage = () => {
//   const [tokenizer, setTokenizer] = useState<PreTrainedTokenizer | null>(null);
//   const [inputText, setInputText] = useState('');
//   const [tokens, setTokens] = useState<number[]>([]);
//   const [loading, setLoading] = useState(true);

//   const handleTokenize =() => {
//     const ids = token
//   }
//   return (
//     <View style={styles.baseLine}>
//       <Text>Enter text to tokenize:</Text>
//       <TextInput
//         style={styles.textBox}
//         placeholder="Enter any text"
//         value={inputText}
//         onChangeText={setInputText}
//       />
//       <Button
//         title={loading ? 'Loading Tokenizer...' : 'Tokenize Text'}
//         // onPress={handleTokenize}
//         disabled={loading}
//       />
//       <Text>Tokens: {tokens.join(', ')}</Text>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   baseLine: {
//     flex: 1,
//     justifyContent: 'center',
//     backgroundColor: 'grey',
//     padding: 10,
//   },
//   textBox: {
//     borderWidth: 1,
//     padding: 10,
//     marginVertical: 10,
//   },
// });

// export default HomePage;
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import tokenizerJson from './assets/tokenizer.json';

const App = () => {
  const [inputText, setInputText] = useState('');
  const [tokenIds, setTokenIds] = useState<number[]>([]);

  const model = tokenizerJson.model;

  const vocab = model?.vocab || {};
  const mergesRaw = model?.merges || [];

  const merges = mergesRaw.map((m: any) =>
    Array.isArray(m) ? m.join(' ') : m,
  );

  const vocabMap = new Map(Object.entries(vocab));
  const mergeRanks = new Map(merges.map((m: string, i: number) => [m, i]));

  const bytePairEncode = (text: string): number[] => {
    let tokens = text.split('');

    while (true) {
      let pairs: string[][] = [];
      for (let i = 0; i < tokens.length - 1; i++) {
        pairs.push([tokens[i], tokens[i + 1]]);
      }

      let minRank = Infinity;
      let bestPair: string[] | null = null;
      for (const pair of pairs) {
        const pairStr = pair.join(' ');
        const rank = mergeRanks.get(pairStr);
        if (rank !== undefined && rank < minRank) {
          minRank = rank;
          bestPair = pair;
        }
      }

      if (!bestPair) break;

      const newTokens: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        if (
          i < tokens.length - 1 &&
          tokens[i] === bestPair[0] &&
          tokens[i + 1] === bestPair[1]
        ) {
          newTokens.push(bestPair.join(''));
          i += 2;
        } else {
          newTokens.push(tokens[i]);
          i++;
        }
      }
      tokens = newTokens;
    }

    const unkId = vocabMap.get('<unk>') ?? 0;
    return tokens.map((t: string) => vocabMap.get(t) ?? unkId);
  };
  const handleTokenize = () => {
    const ids = bytePairEncode(inputText);
    setTokenIds(ids);
  };

  return (
    <View style={{ padding: 20 }}>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: 'gray',
          marginBottom: 10,
          padding: 5,
          height: 40,
        }}
        placeholder="Enter text"
        value={inputText}
        onChangeText={setInputText}
      />
      <Button title="Tokenize" onPress={handleTokenize} />
      <Text style={{ marginTop: 10 }}>Token IDs: {tokenIds.join(', ')}</Text>
    </View>
  );
};

export default App;
