import PromptNode from '../nodes/PromptNode';
import PromptConcatenatorNode from '../nodes/PromptConcatenatorNode';
import PromptEnhancerNode from '../nodes/PromptEnhancerNode';
import LLMNode from '../nodes/LLMNode';
import VideoDescriberNode from '../nodes/VideoDescriberNode';
import ImagenNode from '../nodes/ImagenNode';
import VeoNode from '../nodes/VeoNode';
import ImageDescriberNode from '../nodes/ImageDescriberNode';
import OutputNode from '../nodes/OutputNode';
import LyriaNode from '../nodes/LyriaNode';
import ImageToVideoNode from '../nodes/ImageToVideoNode';
import LevelsNode from '../nodes/LevelsNode';
import CompositorNode from '../nodes/CompositorNode';
import PainterNode from '../nodes/PainterNode';
import CropNode from '../nodes/CropNode';
import ResizeNode from '../nodes/ResizeNode';
import BlurNode from '../nodes/BlurNode';
import InvertNode from '../nodes/InvertNode';
import ChannelsNode from '../nodes/ChannelsNode';
import MaskExtractorNode from '../nodes/MaskExtractorNode';
import MatteAdjustNode from '../nodes/MatteAdjustNode';
import MergeAlphaNode from '../nodes/MergeAlphaNode';
import MaskByTextNode from '../nodes/MaskByTextNode';
import TextIteratorNode from '../nodes/TextIteratorNode';
import NumberNode from '../nodes/NumberNode';
import TextNode from '../nodes/TextNode';
import ToggleNode from '../nodes/ToggleNode';
import ListSelectorNode from '../nodes/ListSelectorNode';
import SeedNode from '../nodes/SeedNode';
import ArrayNode from '../nodes/ArrayNode';
import VideoMatteNode from '../nodes/VideoMatteNode';
import VideoMaskByTextNode from '../nodes/VideoMaskByTextNode';
import ImageIteratorNode from '../nodes/ImageIteratorNode';
import VideoIteratorNode from '../nodes/VideoIteratorNode';
import StickyNoteNode from '../nodes/StickyNoteNode';
import CompareNode from '../nodes/CompareNode';
import ImageUpscalerNode from '../nodes/ImageUpscalerNode';
import VideoUpscalerNode from '../nodes/VideoUpscalerNode';
import FrameInterpolatorNode from '../nodes/FrameInterpolatorNode';
import RelightNode from '../nodes/RelightNode';
import GuidanceStrengthNode from '../nodes/GuidanceStrengthNode';
import MotionIntensityNode from '../nodes/MotionIntensityNode';
import CFGScaleNode from '../nodes/CFGScaleNode';
import DirectorPromptNode from '../nodes/DirectorPromptNode';
import CameraControlNode from '../nodes/CameraControlNode';
import SequenceNode from '../nodes/SequenceNode';
import ImageUploadNode from '../nodes/ImageUploadNode';
import VideoUploadNode from '../nodes/VideoUploadNode';

export const nodeTypes = {
  prompt: PromptNode,
  promptConcatenator: PromptConcatenatorNode,
  promptEnhancer: PromptEnhancerNode,
  directorPrompt: DirectorPromptNode,
  cameraControl: CameraControlNode,
  sequence: SequenceNode,
  llm: LLMNode,
  videoDescriber: VideoDescriberNode,
  imagen: ImagenNode,
  veo: VeoNode,
  vision: ImageDescriberNode,
  imageDescriber: ImageDescriberNode,
  output: OutputNode,
  lyria: LyriaNode,
  imageToVideo: ImageToVideoNode,
  levels: LevelsNode,
  compositor: CompositorNode,
  painter: PainterNode,
  crop: CropNode,
  resize: ResizeNode,
  blur: BlurNode,
  invert: InvertNode,
  channels: ChannelsNode,
  maskExtractor: MaskExtractorNode,
  matteAdjust: MatteAdjustNode,
  mergeAlpha: MergeAlphaNode,
  maskByText: MaskByTextNode,
  textIterator: TextIteratorNode,
  number: NumberNode,
  text: TextNode,
  toggle: ToggleNode,
  listSelector: ListSelectorNode,
  seed: SeedNode,
  array: ArrayNode,
  videoMatte: VideoMatteNode,
  videoMaskByText: VideoMaskByTextNode,
  imageIterator: ImageIteratorNode,
  videoIterator: VideoIteratorNode,
  stickyNote: StickyNoteNode,
  compare: CompareNode,
  imageUpscaler: ImageUpscalerNode,
  videoUpscaler: VideoUpscalerNode,
  frameInterpolator: FrameInterpolatorNode,
  relight: RelightNode,
  guidanceStrength: GuidanceStrengthNode,
  motionIntensity: MotionIntensityNode,
  cfgScale: CFGScaleNode,
  imageUpload: ImageUploadNode,
  videoUpload: VideoUploadNode,
};
