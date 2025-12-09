import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Transaction } from '../types';
import { hashData } from '../services/crypto';

interface MerkleTreeVizProps {
  transactions: Transaction[];
}

interface D3Node {
  name: string;
  children?: D3Node[];
  fullHash: string;
}

const MerkleTreeViz: React.FC<MerkleTreeVizProps> = ({ transactions }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Helper to construct the tree object for D3
  const buildTree = (txs: Transaction[]): D3Node | null => {
    if (txs.length === 0) return null;
    let leaves: D3Node[] = txs.map(tx => ({
      name: tx.id.substring(0, 6) + '...',
      fullHash: tx.id,
      children: []
    }));

    let currentLevel = leaves;
    while (currentLevel.length > 1) {
      const nextLevel: D3Node[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : currentLevel[i];
        
        // In the real blockchain logic we hash strings, here we replicate that
        const combinedHash = hashData(left.fullHash + right.fullHash);
        
        nextLevel.push({
          name: combinedHash.substring(0, 6) + '...',
          fullHash: combinedHash,
          children: (left === right) ? [left] : [left, right] // Visualize dup if odd
        });
      }
      currentLevel = nextLevel;
    }
    return currentLevel[0];
  };

  useEffect(() => {
    if (!svgRef.current || transactions.length === 0) return;

    const rootData = buildTree(transactions);
    if (!rootData) return;

    const width = 800;
    const height = 400;
    const margin = { top: 40, right: 90, bottom: 50, left: 90 };

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", "100%")
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const treeLayout = d3.tree<D3Node>().size([width - margin.left - margin.right, height - margin.top - margin.bottom]);
    
    const root = d3.hierarchy<D3Node>(rootData);
    treeLayout(root);

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 2)
      .attr("d", d3.linkVertical()
          .x((d: any) => d.x)
          .y((d: any) => d.y) as any
      );

    // Nodes
    const nodes = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

    nodes.append("circle")
      .attr("r", 15)
      .attr("fill", (d) => d.children ? "#3b82f6" : "#10b981") // Blue for branches, Green for leaves
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodes.append("text")
      .attr("dy", ".35em")
      .attr("y", (d) => d.children ? -25 : 25)
      .attr("text-anchor", "middle")
      .text((d) => d.data.name)
      .style("font-size", "12px")
      .style("fill", "#475569")
      .style("font-family", "monospace");

  }, [transactions]);

  if (transactions.length === 0) {
    return <div className="p-8 text-center text-gray-400">No transactions in this block to visualize.</div>;
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
      <h3 className="text-center py-2 font-bold text-slate-700">Merkle Tree Visualization</h3>
      <svg ref={svgRef} className="mx-auto block"></svg>
      <div className="text-xs text-center pb-2 text-slate-400">Leaves = Transactions, Root = Merkle Root</div>
    </div>
  );
};

export default MerkleTreeViz;
