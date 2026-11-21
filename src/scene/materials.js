import * as THREE from 'three'

/**
 * Material that shows one tile of a 2×2 texture atlas per instance (graffiti walls, billboards,
 * neon signs, station signs). The tile index comes from an `aTile` instanced attribute.
 */
export function makeAtlasMaterial({ map, basic = false, emissive = 0, color = '#ffffff', roughness = 0.8, side = THREE.FrontSide }) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map, color, side, toneMapped: emissive === 0 })
    : new THREE.MeshStandardMaterial({ map, color, roughness, metalness: 0.05, side, emissiveMap: emissive ? map : null, emissive: emissive ? '#ffffff' : '#000000', emissiveIntensity: emissive })
  mat.customProgramCacheKey = () => `atlas-${basic}`
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vec2 tileOffset = vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;
        #ifdef USE_MAP
          vMapUv = vMapUv * 0.5 + tileOffset;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = vEmissiveMapUv * 0.5 + tileOffset;
        #endif`,
      )
  }
  return mat
}

/**
 * Building facade material with fully procedural windows.
 * Window cells are computed from the instance's scaled local position, so any building
 * size keeps a correct floor/column grid. A stable per-building seed comes from instanceColor.
 */
export function makeBuildingMaterial({
  color = '#3a4252',
  roughness = 0.8,
  metalness = 0.15,
  warm = '#ffc27a',
  cool = '#9cc2ff',
  glassTint = '#0b1424',
  lit = 0.42,
  intensity = 1.6,
  floorH = 3.2,
  colW = 2.6,
  shop = '#ffb870',
  shopIntensity = 0.0,
  style = 0, // 0: concrete, 1: glass tower
}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const uniforms = {
    uWarm: { value: new THREE.Color(warm) },
    uCool: { value: new THREE.Color(cool) },
    uGlass: { value: new THREE.Color(glassTint) },
    uShop: { value: new THREE.Color(shop).multiplyScalar(shopIntensity) },
    uLit: { value: lit },
    uIntensity: { value: intensity },
    uFloorH: { value: floorH },
    uColW: { value: colW },
    uStyle: { value: style },
  }
  mat.userData.uniforms = uniforms
  mat.customProgramCacheKey = () => 'nocturne-building'
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBLocal;
        varying vec3 vBNormal;
        varying vec3 vBScale;
        varying float vBSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 bScale = vec3(1.0);
        vBSeed = 0.37;
        #ifdef USE_INSTANCING
          bScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #endif
        #ifdef USE_INSTANCING_COLOR
          vBSeed = fract(instanceColor.r * 91.7 + instanceColor.g * 47.3 + instanceColor.b * 13.1);
        #endif
        vBScale = bScale;
        vBLocal = position * bScale;
        vBNormal = normal;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uWarm;
        uniform vec3 uCool;
        uniform vec3 uGlass;
        uniform vec3 uShop;
        uniform float uLit;
        uniform float uIntensity;
        uniform float uFloorH;
        uniform float uColW;
        uniform float uStyle;
        varying vec3 vBLocal;
        varying vec3 vBNormal;
        varying vec3 vBScale;
        varying float vBSeed;
        float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 an = abs(vBNormal);
          float side = step(an.y, 0.5);
          float u = an.x > 0.5 ? vBLocal.z : vBLocal.x;
          float halfW = an.x > 0.5 ? vBScale.z * 0.5 : vBScale.x * 0.5;
          float v = vBLocal.y;
          float ground = uFloorH * 1.25;
          vec2 g = vec2((u + 37.0 * vBSeed) / uColW, (v - ground) / uFloorH);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          float mullionX = uStyle > 0.5 ? 0.06 : 0.17;
          float mullionY = uStyle > 0.5 ? 0.1 : 0.24;
          float inWin = step(mullionX, f.x) * step(f.x, 1.0 - mullionX) * step(mullionY, f.y) * step(f.y, 0.86);
          inWin *= step(0.0, g.y) * step(v, vBScale.y - uFloorH * 0.6);
          inWin *= step(abs(u), halfW - 0.6);
          float h1 = bHash(cell + vBSeed * 113.0);
          float h2 = bHash(cell.yx * 1.7 + vBSeed * 57.0);
          // whole floors tend to be lit together for a believable pattern
          float floorBias = bHash(vec2(cell.y, vBSeed * 9.0));
          float lit = step(1.0 - uLit, mix(h1, floorBias, 0.45));
          vec3 wc = mix(uWarm, uCool, step(0.55 - uStyle * 0.35, h2)) * (0.45 + h2 * 0.9);
          totalEmissiveRadiance += side * inWin * lit * wc * uIntensity;
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, side * inWin * (1.0 - lit));
          roughnessFactor = mix(roughnessFactor, 0.12, side * inWin);
          metalnessFactor = mix(metalnessFactor, 0.9, side * inWin * (1.0 - lit));
          // street-level storefronts: framed bays, some lit warm, some cool, some dark
          float bayX = (u + 11.0 * vBSeed) / 3.2;
          float bay = floor(bayX);
          float bf = fract(bayX);
          float bayH = bHash(vec2(bay, vBSeed * 31.0));
          float panel = side * step(0.1, bf) * step(bf, 0.9) * step(0.55, v) * step(v, ground - 0.85) * step(abs(u), halfW - 0.8);
          float bayLit = step(0.42, bayH);
          vec3 shopCol = mix(uShop, uCool * 0.55, step(0.78, bayH));
          // soft vertical falloff: brighter near the bottom like interior light spill
          float spill = mix(1.0, 0.45, smoothstep(0.55, ground - 0.85, v));
          totalEmissiveRadiance += panel * bayLit * shopCol * spill * (0.45 + 0.55 * bayH);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, panel * (1.0 - bayLit));
          roughnessFactor = mix(roughnessFactor, 0.1, panel);
          // glass towers: vertical light seams on the corners + crown line
          if (uStyle > 0.5) {
            float edge = side * (1.0 - step(0.18, halfW - abs(u)));
            float crown = side * step(vBScale.y - 1.2, v) * step(v, vBScale.y - 0.8);
            totalEmissiveRadiance += (edge + crown) * uCool * 1.25;
          }
        }`,
      )
  }
  return mat
}
