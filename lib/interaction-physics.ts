import { Vector3 } from "three";

export function applySpringReturn(
  displacement: Vector3,
  velocity: Vector3,
  stiffness: number,
  damping: number,
  delta: number,
) {
  velocity.addScaledVector(displacement, -stiffness * delta);
  velocity.multiplyScalar(Math.pow(damping, delta * 60));
  displacement.addScaledVector(velocity, delta);
}

export function forceFromPointer(
  nodePosition: Vector3,
  pointerPosition: Vector3,
  pointerDirection: Vector3,
  pointerVelocity: number,
  radius: number,
) {
  const away = nodePosition.clone().sub(pointerPosition);
  const distance = Math.max(away.length(), 0.001);
  if (distance > radius) return null;
  const falloff = 1 - distance / radius;
  const radial = away.normalize().multiplyScalar(0.42);
  const wake = pointerDirection.lengthSq() > 0.0001
    ? pointerDirection.clone().normalize().multiplyScalar(0.78)
    : new Vector3();
  return radial.add(wake).multiplyScalar(falloff * falloff * pointerVelocity);
}
