import React, { Component } from 'react';
import { Dimensions, ScrollView } from 'react-native';
import {
  View,
  Button,
  Icon,
  Text,
  Left,
  Right,
} from 'native-base';
import { ethers } from 'ethers';
import {
  ResolverRuntimeMulti,
  ResolverSourceJs,
  ResolverSourceSolidity,
  SourceWasmJavascript,
  RuntimeWasmJavascript,
  SourceJavascript,
  RuntimeJavascript,
  SourceWeb3Javascript,
  RuntimeWeb3Javascript,
  SourceSolidity,
} from '@pipeos/pipejs';
import pipecanvas from '@pipeos/pipecanvas';
import { solidityBuilder, enrichedGraphSteps } from '@pipeos/pipesource';
import { FunctionCall } from '@pipeos/react-function-call-ui';
import { pfunctionColor } from '@pipeos/react-pipeos-components';
import Workspace from './Workspace.js';
import Pipeoutput from './Pipeoutput.js';
import GraphSave from './GraphSave.js';
import GraphMarkdown from './markdown/GraphMarkdown.js';
import { getPageSize } from '../utils/utils.js';
import { getPipegraphInfo } from '../utils/pipecanvas.js';
import { getWeb3 } from '../utils/utils.js';
import { createRemixClient } from '../utils/remix.js';
import { getInterpreter } from '../utils/interpreter.js';
import { saveGraph, getGraphs, getGraphContext } from '../utils/graph.js';
import { getEtherscanTx } from '../utils/chain.js';
import { buildinterpreterArgs, buildinterpreterInputs } from '../utils/interpreter.js';
import { getContractFixtures, getWasmFixtures } from '../utils/fixtures.js';
import styles from './Styles.js';

const DEFAULT_PIPERUN = { pfunction: {gapi: {inputs: [], outputs: []}}, deployment: {} };

const fetchWasmUrl = async (deployment) => {
  return await (await fetch(deployment)).arrayBuffer();
}

class AppContent extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ...this.getWindowDimensions(),
      pageSizes: this.getPageSizes(),
      selectedFunctions: [],
      pipeContext: [],
      canvases: 1,
      activeCanvas: 0,
      pipeGraphs: [],
      graphsSource: [],
      pipeoutput: {},
      piperun: JSON.parse(JSON.stringify(DEFAULT_PIPERUN)),
      pipeinterpreter: {},
      web3: null,
      treedata: [],
      graphdata: [],
      savedGraph: null,
      pipeoutputComponent: 'runJavascript',
      runInterpreterValues: null,
    }

    this.FOOTER_HEIGHT = 41;
    this.scrollRef = React.createRef();

    this.onContentSizeChange = this.onContentSizeChange.bind(this);
    this.onToggleItem = this.onToggleItem.bind(this);
    this.onGraphLoad = this.onGraphLoad.bind(this);
    this.onGraphNodeItem = this.onGraphNodeItem.bind(this);
    this.onClearCanvas = this.onClearCanvas.bind(this);
    this.onAddCanvas = this.onAddCanvas.bind(this);
    this.onGoToWorkspace = this.onGoToWorkspace.bind(this);
    this.onGoToPipeoutput = this.onGoToPipeoutput.bind(this);
    this.onGoToPipecanvas = this.onGoToPipecanvas.bind(this);
    this.onGoToPiperun = this.onGoToPiperun.bind(this);
    this.onPiperun = this.onPiperun.bind(this);
    this.onGraphSave = this.onGraphSave.bind(this);
    this.saveGraph = this.saveGraph.bind(this);
    this.onRunInterpreter = this.onRunInterpreter.bind(this);
    this.onJsRun = this.onJsRun.bind(this);
    this.onInterpreterRun = this.onInterpreterRun.bind(this);
    this.onRunInterpreterValueChange = this.onRunInterpreterValueChange.bind(this);

    this.loadData = this.loadData.bind(this);

    Dimensions.addEventListener('change', () => {
      this.onContentSizeChange();
    });

    this.setWeb3();
    this.setRemixClient();
  }

  componentDidMount() {
    window.ethers = ethers;
    this.addCanvasGraph(0);
  }

  async setWeb3() {
    const web3 = await getWeb3();
    const chainid = parseInt(web3.version.network);
    const pipeinterpreter = getInterpreter(web3);
    this.setState({ web3, pipeinterpreter });
    this.setGraphs(chainid);

    let treedata = await getContractFixtures(chainid);
    treedata = treedata.concat(await getWasmFixtures());
    this.setState({ web3, pipeinterpreter, treedata });
  }

  getGraphResolvers(web3) {
    web3 = web3 || this.state.web3;
    const provider = new ethers.providers.Web3Provider(web3.currentProvider);
    const signer = provider.getSigner();

    const runtimeWasmJs = new RuntimeWasmJavascript(fetchWasmUrl);
    const runtimeJs = new RuntimeJavascript();
    const runtimeWeb3 = new RuntimeWeb3Javascript(provider, signer, ethers);
    const runtimeResolvers = {wasm: runtimeWasmJs, javascript: runtimeJs, solidity: runtimeWeb3};

    const sourceWasmJs = new SourceWasmJavascript();
    const sourceJs = new SourceJavascript();
    const sourceWeb3 = new SourceWeb3Javascript();
    const sourceResolversJs = {wasm: sourceWasmJs, javascript: sourceJs, solidity: sourceWeb3};
    const sourceSol = new SourceSolidity();

    return {
      runtime: new ResolverRuntimeMulti(runtimeResolvers),
      sourcejs: new ResolverSourceJs(sourceResolversJs),
      sourcesol: new ResolverSourceSolidity({solidity: sourceSol}),
    }
  }

  async setGraphs(chainid) {
    const graphdata = await getGraphs(chainid);
    this.setState({ graphdata });
  }

  async setRemixClient() {
    this.remixClient = await createRemixClient({
      loadChainLensWorkspace: this.loadData,
    });
  }

  loadData(pclasses = []) {
    let treedata = this.state.treedata;

    pclasses.forEach(pclass => {
      const exists = treedata.find(item => item._id === pclass._id);
      if (!exists) treedata.push(pclass);
    });

    this.setState({ treedata });
    return true;
  }

  // componentDidUpdate(prevProps, prevState) {
  //   if (prevState.canvases < this.state.canvases) {
  //
  //     // this.addCanvasGraph(this.state.canvases - 1);
  //   }
  // }

  getPageSizes(width, height) {
    return {
      canvas: getPageSize(3 / 2, { width, height: height - this.FOOTER_HEIGHT }),
      page: getPageSize(3, { width, height }),
    }
  }

  getWindowDimensions() {
    let wdims = Dimensions.get('window');
    let rootDims = document.getElementById('PipelineRoot').getBoundingClientRect();

    const dims = {
      width: wdims.width || rootDims.width,
      height: wdims.height || rootDims.height,
    }
    return dims;
  }

  onGraphSave() {
    this.setState({ pipeoutputComponent: 'editGraphMarkdown' });
    this.onGoToPiperun();
  }

  async saveGraph({ name, namespace, markdown }) {
    const graphData = {
      data: {
        name: `${namespace}.${name}`,
        markdown,
      },
      metadata: {categories: ['pgraph'], namespace},
    }

    const chainid = parseInt(this.state.web3.version.network);
    const { savedGraph, receipt } = await saveGraph(
      chainid,
      this.state.pipeinterpreter.full,
      graphData,
      this.state.pipeoutput,
    );

    if (!savedGraph) {
      return {};
    }

    this.setState({ savedGraph: savedGraph });

    let link;
    if (receipt.transactionHash) {
      console.log('response', savedGraph, receipt, receipt.transactionHash);
      link = getEtherscanTx(chainid, receipt.transactionHash);
    }
    return { savedGraph, link };
  }

  onJsRun() {
    this.setState({ pipeoutputComponent: 'runJavascript' });
    this.onGoToPiperun();
  }

  onInterpreterRun() {
    this.setState({ pipeoutputComponent: 'runInterpreter' });
    this.onGoToPiperun();
  }

  async onRunInterpreter(inputValues) {
    console.log('Running JavaScript script...');
    const { onlySolidity } = this.state.pipeoutput;

    if (!onlySolidity) {
      return await this.onPiperun(inputValues);
    }
    return this.onRunInterpreterSolidity(inputValues);
  }

  async onRunInterpreterSolidity(inputValues) {
    const { graphAbi, interpreterGraph } = this.state.pipeoutput;
    let isTransaction = false;
    let pipeinterpreter;
    let result;

    if (
      graphAbi.stateMutability === 'view'
      || graphAbi.stateMutability === 'pure'
    ) {
      pipeinterpreter = this.state.pipeinterpreter.view;
    } else {
      pipeinterpreter = this.state.pipeinterpreter.full;
      isTransaction = true;
    }

    const inputs = graphAbi.inputs.map((inp, i) => {
      return { type: inp.type, value: inputValues[i]};
    })
    const input = buildinterpreterInputs(inputs);

    const payValue = interpreterGraph.steps
      .map(step => {
        return step.payIndex ? (inputValues[step.payIndex - 1] || 0) : 0
      })
      .reduce((accum, value) => accum += value, 0);
    const txconfig = payValue ? { value: payValue } : {};

    if (this.state.savedGraph) {
      const index = this.state.savedGraph.data.onchainid;
      console.log('Running graph in the PipeGraphInterpreter (run)...', index, input, txconfig);
      result = await pipeinterpreter.run(index, input, txconfig);
    } else {
      const graphData = {
        steps: interpreterGraph.steps,
        outputIndexes: interpreterGraph.outputIndexes,
      }
      console.log('Running graph in the PipeGraphInterpreter (runMemory)...', graphData, input, txconfig);
      result = await pipeinterpreter.runMemory(graphData, input, txconfig);
    }
    console.log('-- Result: ', result);

    if (isTransaction) return result;

    const parsedResult = ethers.utils.defaultAbiCoder.decode(graphAbi.outputs.map(out => out.type), result);
    return parsedResult;
  }

  onRunInterpreterValueChange(values) {
    this.setState({ runInterpreterValues: JSON.stringify(values)});
  }

  addCanvasGraph(activeCanvas) {
    const { width, height } = this.state.pageSizes.canvas;

    const newgraph = pipecanvas(
      this.state.pipeContext[activeCanvas],
      this.state.graphsSource[activeCanvas],
      {
        width,
        height,
        domid: `#draw_canvas${activeCanvas}`,
        bodyColorFunction: pfunctionColor,
      }
    );
    newgraph.onChange(new_gr => {
      this.onGraphChange(new_gr, newgraph);
    });
    newgraph.show();

    const pipeGraphs = this.state.pipeGraphs;
    pipeGraphs[activeCanvas] = newgraph;
    this.setState({ pipeGraphs });
  }

  async onGraphChange(new_gr, graphinstance) {
    const pipeoutput = await getPipegraphInfo(
      new_gr,
      this.state.activeCanvas,
      this.state.selectedFunctions,
      graphinstance,
      this.getGraphResolvers(),
    );

    const newGraph = JSON.parse(JSON.stringify(new_gr));
    newGraph.enriched_graph = enrichedGraphSteps(new_gr);
    pipeoutput.pipegraph = newGraph;

    if (pipeoutput.onlySolidity) {
      pipeoutput.interpreterGraph = buildinterpreterArgs(
        [pipeoutput.pipegraph.rich_graph],
        pipeoutput.graphStepsAbi,
        [pipeoutput.graphAbi],
      ).allArgs[0];
    } else {
      pipeoutput.interpreterGraph = {};
    }

    const piperun = {
      pfunction: {
        gapi: pipeoutput.graphAbi,
        signatureString: 'signatureString',
      },
      deployment: { chainid: this.state.web3.version.network}
    }
    // console.log('onGraphChange pipeoutput', pipeoutput);
    this.setState({ pipeoutput, piperun });
  }

  async onPiperun(inputs) {
    console.log('Executing graph...');
    const { pipeoutput } = this.state;
    return await pipeoutput.execute(inputs);
  }

  prepGraphFunction(pfunction, pclass) {
    const newpclass = {
      _id: pclass._id,
      name: pclass.data.name,
      type: pclass.metadata.categories[0],
      deployment: pclass.pclassInstances[0].data.deployment.address || pclass.pclassInstances[0].data.deployment,
    }
    const gapi = JSON.parse(JSON.stringify(pfunction.data.gapi));
    let pfunc = {
      _id: pfunction._id,
      pclassid: pfunction.pclassid,
      pfunction: {
        gapi,
        signature: pfunction.data.signature,
        graph: pfunction.data.shortPgraph || {},
        sources: {},
      },
      timestamp: pfunction.timestamp,
      pclass: newpclass,
    }
    if (pfunc.pclass.type === 'solidity') {
      pfunc = solidityBuilder.enrichAbi(pfunc);
    }
    return pfunc;
  }

  onContentSizeChange() {
    const { width, height } = this.getWindowDimensions();
    const pageSizes = this.getPageSizes(width, height);

    this.setState({ width, height, pageSizes });
    this.state.pipeGraphs.forEach(pipegraph => {
      pipegraph.setOptions({
        width: pageSizes.canvas.width,
        height: pageSizes.canvas.height
      });
      pipegraph.show();
    });
  }

  async onToggleItem({ pfunction, pclass }) {
    const pfunc = this.prepGraphFunction(pfunction, pclass);
    const selectedFunctions = this.state.selectedFunctions;
    const pipeContext = this.state.pipeContext;

    if (!selectedFunctions[this.state.activeCanvas]) {
      selectedFunctions[this.state.activeCanvas] = {};
      pipeContext[this.state.activeCanvas] = {};
    }

    selectedFunctions[this.state.activeCanvas][pfunction._id] = Object.assign({}, pfunction, { pclass });
    pipeContext[this.state.activeCanvas][pfunction._id] = pfunc;

    if (pfunction.data.shortPgraph && pfunction.data.shortPgraph.n) {
      const context = await getGraphContext(pfunction.data.shortPgraph);
      for (let fcontext of context) {
        const fprep = this.prepGraphFunction(fcontext, fcontext.pclass);
        pipeContext[this.state.activeCanvas][fcontext._id] = fprep;
        this.state.pipeGraphs[this.state.activeCanvas].pipe.add_indexed_func(fprep);
      }
    }

    this.setState({ selectedFunctions, pipeContext });
    this.state.pipeGraphs[this.state.activeCanvas].addFunction(pfunc);
  }

  onGraphNodeItem({ pfunction, pclass }) {
    this.onToggleItem({ pfunction, pclass });
  }

  async onGraphLoad({ pfunction, pclass }) {
    console.log('onGraphLoad', pfunction, pclass);
    const selectedFunctions = this.state.selectedFunctions;
    const pipeContext = this.state.pipeContext;
    const context = await getGraphContext(pfunction.data.shortPgraph);

    if (!selectedFunctions[this.state.activeCanvas]) {
      selectedFunctions[this.state.activeCanvas] = {};
      pipeContext[this.state.activeCanvas] = {};
    }

    context.forEach(pfunction => {
      const pclass = pfunction.pclass;
      const pfunc = this.prepGraphFunction(pfunction, pclass);

      selectedFunctions[this.state.activeCanvas][pfunc._id] = Object.assign({}, pfunction, { pclass });
      pipeContext[this.state.activeCanvas][pfunc._id] = pfunc;
    });

    this.setState({ selectedFunctions, pipeContext, savedGraph: pfunction });

    const pipegraph = this.state.pipeGraphs[this.state.activeCanvas];
    pipegraph.clear();
    pipegraph.setGraph(pfunction.data.shortPgraph, pipeContext[this.state.activeCanvas]);
    pipegraph.show();

    this.onGraphChange(pipegraph.getGraph(), pipegraph);
  }

  onAddCanvas() {
    let canvases = this.state.canvases;
    canvases += 1;
    this.setState({ canvases });
    // this.addCanvasGraph(canvases - 1);
  }

  onClearCanvas(canvasNo) {
    canvasNo = canvasNo || this.state.activeCanvas;

    this.state.pipeGraphs[canvasNo].clear();
    this.setState({
      selectedFunctions: [],
      pipeContext: [],
      graphsSource: [],
      pipeoutput: {},
      piperun: JSON.parse(JSON.stringify(DEFAULT_PIPERUN)),
      savedGraph: null,
      runInterpreterValues: null,
    });
  }

  onGoToWorkspace() {
    this.scrollRef.current.scrollTo({x: 0, y: 0, animated: true});
  }

  onGoToPipeoutput() {
    const { pageSizes } = this.state;
    let width = pageSizes.page.width;
    if (pageSizes.page.width === pageSizes.canvas.width) {
      width += pageSizes.canvas.width;
    }
    this.scrollRef.current.scrollTo({x: width, y: 0, animated: true});
  }

  onGoToPipecanvas() {
    const { width } = this.state.pageSizes.page;
    this.scrollRef.current.scrollTo({x: width, y: 0, animated: true});
  }

  onGoToPiperun() {
    this.scrollRef.current.scrollToEnd();
  }

  render() {
    const { pageSizes, canvases, activeCanvas, treedata, graphdata, pipeoutputComponent, savedGraph, pipeoutput, runInterpreterValues } = this.state;

    const markdown = savedGraph && savedGraph.data && savedGraph.data.markdown ? savedGraph.data.markdown : '';
    const namespace = savedGraph && savedGraph.metadata && savedGraph.metadata.namespace ? savedGraph.metadata.namespace : '';
    const graphgapi = pipeoutput.graphAbi;

    // const canvasTabs = new Array(canvases).fill(0).map((canvas, i) => {
    //   return (
    //     <canvas id={'draw_canvas' + i} key={i}></canvas>
    //   )
    // });

    const activeCanvasEl = (
        <canvas id={'draw_canvas' + activeCanvas}></canvas>
    )

    const canvasTabButtons = Array(canvases).fill(0).map((canvas, i) => {
      return (
        <View key={i} style={{flexDirection: "row", alignItems: "center"}}>
          <Button
            small bordered dark
            onClick={() => this.setState({ activeCanvas: i })}
            style={ styles.tabButtonStyle }
          >
            <Text>{'f_' + i}</Text>
          </Button>

          <Button
            small rounded
            style={styles.buttonStyle}
            onClick={() => this.onClearCanvas(i)}
          >
            <Icon name="close" />
          </Button>
        </View>
      )
    });

    let outputComponent;
    switch (pipeoutputComponent) {
      case 'runJavascript':
        outputComponent = (
          <FunctionCall
            styles={{ ...this.props.styles, ...pageSizes.canvas }}
            buttonStyle={styles.buttonStyle}
            web3={this.state.web3}
            item={this.state.piperun}
            onRun={this.onPiperun}
            onInfoClosed={this.onGoToPipeoutput}
            pfunctionColor={pfunctionColor}
          />
        );
        break;
      case 'runInterpreter':
        const viewStyles = { ...this.props.styles, ...pageSizes.canvas };
        const mdheight = viewStyles.height / 3;
        const mdStyles = { ...viewStyles, height: mdheight, minHeight: mdheight, maxHeight: mdheight };
        let fcallStyles;
        if (markdown) {
          const fcallheight = viewStyles.height - mdheight + 46;
          fcallStyles = { ...viewStyles, height: fcallheight, minHeight: fcallheight, maxHeight: fcallheight };
        } else {
          fcallStyles = viewStyles;
        }


        outputComponent = (
          <View styles={{ ...viewStyles, flex: 1 }}>
            {markdown
              ? <GraphMarkdown
                value={markdown}
                gapi={graphgapi}
                gapiValues={runInterpreterValues}
                preview={'preview'}
                styles={{ ...mdStyles }}
                onChange={this.onChangeMarkdown}
              />
              : null
            }
            <FunctionCall
              styles={{ ...fcallStyles }}
              buttonStyle={styles.buttonStyle}
              web3={this.state.web3}
              item={this.state.piperun}
              onRun={this.onRunInterpreter}
              onInfoClosed={this.onGoToPipeoutput}
              onChange={this.onRunInterpreterValueChange}
              pfunctionColor={pfunctionColor}
            />
          </View>
        );
        break;
      case 'editGraphMarkdown':
        outputComponent = (
          <GraphSave
            styles={{ ...this.props.styles, ...pageSizes.canvas }}
            buttonStyle={styles.buttonStyle}
            gapi={graphgapi}
            markdown={markdown}
            namespace={namespace}
            goBack={this.onGoToPipeoutput}
            onGraphSave={this.saveGraph}
          />
        );
        break;
      default:
        throw new Error('pipeoutputComponent unknown: ' + pipeoutputComponent);
    }

    return (
      <ScrollView
        ref={this.scrollRef}
        horizontal={true}
        pagingEnabled={true}
        scrollEnabled={true}
        scrollEventThrottle={100}
        nestedScrollEnabled={true}
        contentContainerStyle={{width: "100%"}}
        onContentSizeChange={this.onContentSizeChange}
      >
        <Workspace
          styles={{ ...this.props.styles, ...pageSizes.page }}
          onToggleItem={this.onToggleItem}
          onGraphLoad={this.onGraphLoad}
          onGraphNodeItem={this.onGraphNodeItem}
          onGoBack={this.onGoToPipecanvas}
          onRemove={ () => {} }
          treedata={treedata}
          graphdata={graphdata}
        />

        <View style={{...this.props.styles, flex: 1}}>
          <View style={{
            ...pageSizes.canvas,
            flex: 1,
            backgroundColor: "#fafafa"
          }}>
            {activeCanvasEl}
          </View>
          <View style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 5,
            borderTopWidth: 1,
            borderTopColor: '#cccccc',
          }}>
            <Left>
              <Button
                small rounded
                style={styles.buttonStyle}
                onClick={this.onGoToWorkspace}
              >
                <Icon type="MaterialCommunityIcons" name='chevron-left' />
              </Button>
            </Left>
            <Button
              small rounded
              style={styles.buttonStyle}
              onClick={() => this.onClearCanvas()}
            >
              <Icon type="MaterialCommunityIcons" name='close' />
            </Button>
            <Right>
              <Button
                small rounded
                style={styles.buttonStyle}
                onClick={this.onGoToPipeoutput}
              >
                <Icon type="MaterialCommunityIcons" name='chevron-right' />
              </Button>
            </Right>
          </View>
        </View>

        <Pipeoutput
          styles={{ ...this.props.styles, ...pageSizes.page }}
          data={this.state.pipeoutput}
          remixClient={this.remixClient}
          goBack={this.onGoToWorkspace}
          onJsRun={this.onJsRun}
          onGraphSave={this.onGraphSave}
          onRunInterpreter={this.onInterpreterRun}
        />
        { outputComponent }
      </ScrollView>
    )
  }
}

export default AppContent;

// <Left>
//   <Button
//     small rounded
//     style={styles.buttonStyle}
//     onClick={this.onAddCanvas}
//   >
//     <Icon name="add" />
//   </Button>
// </Left>
// <View style={{flexDirection: "row", alignItems: "center"}}>
//   {canvasTabButtons}
// </View>
