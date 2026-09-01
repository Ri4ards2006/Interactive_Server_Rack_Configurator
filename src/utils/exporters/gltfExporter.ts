/**
 * gltfExporter.ts
 *
 * 3D Scene to GLTF / binary GLB serialization engine using Three.js GLTFExporter.
 * Allows instant export of the rack geometry, chassis meshes, and cable curves for CAD / Blender.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { downloadFile } from './bomExporter';

export interface GLTFExportOptions {
  binary?: boolean; // Default true (.glb)
  onlyVisible?: boolean;
  truncateDrawRange?: boolean;
}

/**
 * Exports a Three.js Object3D / Scene to a downloadable binary .glb or .gltf file.
 */
export function exportSceneToGLTF(
  input: THREE.Object3D,
  filename: string = 'datacenter_rack_layout.glb',
  options: GLTFExportOptions = { binary: true },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();

    exporter.parse(
      input,
      (result) => {
        try {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            downloadFile(filename, blob, 'model/gltf-binary');
          } else {
            const output = JSON.stringify(result, null, 2);
            downloadFile(
              filename.endsWith('.gltf') ? filename : `${filename}.gltf`,
              output,
              'model/gltf+json',
            );
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      (error) => {
        reject(error);
      },
      {
        binary: options.binary ?? true,
        onlyVisible: options.onlyVisible ?? true,
      },
    );
  });
}
