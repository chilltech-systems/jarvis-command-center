import type { AvaRuntimeEntity, AvaRuntimeEntityType } from "@/lib/ava/runtime/types";
import type { AvaCoreJson } from "@/lib/ava/core/types";

type EntityInput = {
  id: string;
  type: AvaRuntimeEntityType;
  name: string;
  aliases?: string[];
  metadata?: Record<string, AvaCoreJson>;
};

export function createAvaRuntimeEntityRegistry(initialEntities: AvaRuntimeEntity[] = []) {
  const entities = new Map<string, AvaRuntimeEntity>();

  for (const entity of initialEntities) {
    entities.set(entity.id, entity);
  }

  function registerEntity(input: EntityInput) {
    const now = new Date().toISOString();
    const existing = entities.get(input.id);
    const entity: AvaRuntimeEntity = {
      id: input.id,
      type: input.type,
      name: input.name,
      aliases: input.aliases || existing?.aliases || [],
      metadata: input.metadata || existing?.metadata || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    entities.set(entity.id, entity);

    return entity;
  }

  function getEntity(id: string) {
    return entities.get(id) || null;
  }

  function listEntities(type?: AvaRuntimeEntityType) {
    const allEntities = Array.from(entities.values());

    return type ? allEntities.filter((entity) => entity.type === type) : allEntities;
  }

  function updateEntity(id: string, patch: Partial<Omit<AvaRuntimeEntity, "id" | "createdAt">>) {
    const existing = entities.get(id);
    if (!existing) return null;

    const updated: AvaRuntimeEntity = {
      ...existing,
      ...patch,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    entities.set(id, updated);

    return updated;
  }

  function removeEntity(id: string) {
    return entities.delete(id);
  }

  return {
    registerEntity,
    getEntity,
    listEntities,
    updateEntity,
    removeEntity,
  };
}
