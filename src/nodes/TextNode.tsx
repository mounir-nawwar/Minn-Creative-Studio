import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeInput, RunButton, NodeOutput } from './ui';

const TextNode = ({ id, data }: any) => {
  const [text, setText] = useState(data.config?.text || '');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => updateNodeData(id, { output: text, isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Text value">
          <NodeInput
            type="text"
            placeholder="Enter text…"
            value={text}
            onChange={(e) => { setText(e.target.value); updateNodeData(id, { config: { ...data.config, text: e.target.value } }); }}
          />
        </NodeField>

        <RunButton onClick={handleRun}>Set text</RunButton>

        {data.output && (
          <NodeOutput label="Current output">
            <p className="truncate">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default TextNode;
