import {useEffect, useRef, useState} from 'react';
import {IndiInfo} from 'topola';
import {TopolaData} from '../util/gedcom_util';
import {WebMcpBridge} from '../webmcp';

/**
 * Custom hook to manage the lifecycle and synchronization of the WebMCP bridge.
 * It instantiates the WebMcpBridge and coordinates tool registration, data updates,
 * detail selection updates, and selection callbacks.
 */
export function useWebMcpBridge(
  data: TopolaData | undefined | null,
  detailIndi: string | undefined | null,
  onSelection: (selection: IndiInfo) => void,
) {
  const [mcpBridge] = useState(() => new WebMcpBridge());

  // Store the onSelection callback in a ref to prevent recreating the selection callback effect
  // when onSelection changes.
  const onSelectionRef = useRef(onSelection);
  useEffect(() => {
    onSelectionRef.current = onSelection;
  }, [onSelection]);

  // Handle registration and cleanup of WebMCP tools.
  useEffect(() => {
    mcpBridge.registerTools();
    return () => {
      mcpBridge.unregisterTools();
    };
  }, [mcpBridge]);

  // Synchronize the active dataset with the bridge.
  useEffect(() => {
    mcpBridge.setData(data || null);
  }, [data, mcpBridge]);

  // Synchronize the currently selected individual for details display with the bridge.
  useEffect(() => {
    mcpBridge.setDetailIndi(detailIndi || null);
  }, [detailIndi, mcpBridge]);

  // Register the viewport navigation callback with the bridge.
  useEffect(() => {
    mcpBridge.setSetSelectionCallback((id: string) => {
      onSelectionRef.current({id, generation: 0});
    });
  }, [mcpBridge]);
}
