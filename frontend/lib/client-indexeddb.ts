import type { Client, CreateClientInput, UpdateClientInput } from "@/shared/client";

const DB_NAME = "agencia-aurora-clients-db";
const STORE_NAME = "clients";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("No se pudo abrir IndexedDB para clientes."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function getStore(mode: IDBTransactionMode) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);
  return { database, transaction, store };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeText(value: string): string {
  return value.trim();
}

function assertPassword(password: string): void {
  if (password.trim().length < 4) {
    throw new Error("La clave debe tener al menos 4 caracteres.");
  }
}

function assertEmail(email: string): void {
  if (!email.includes("@")) {
    throw new Error("El correo no es valido.");
  }
}

function getSeedClient(): Client {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    fullName: "Cliente Demo",
    email: "demo@agenciaaurora.com",
    phone: "51999999998",
    password: "Demo1234",
    status: "approved",
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureSeeded(): Promise<void> {
  const { database, transaction, store } = await getStore("readwrite");
  const clients = await requestResult(store.getAll());
  const demoEmail = "demo@agenciaaurora.com";
  const existingDemo = clients.find((client) => client.email === demoEmail);

  if (!existingDemo) {
    await requestResult(store.add(getSeedClient()));
  } else if (existingDemo.password !== "Demo1234" || existingDemo.status !== "approved") {
    await requestResult(
      store.put({
        ...existingDemo,
        password: "Demo1234",
        status: "approved",
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo inicializar IndexedDB para clientes."));
    };
  });
}

export async function listClients(): Promise<Client[]> {
  await ensureSeeded();
  const { database, transaction, store } = await getStore("readonly");
  const clients = await requestResult(store.getAll());

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudieron listar los clientes."));
    };
  });

  return clients.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function registerClient(input: CreateClientInput): Promise<Client> {
  assertEmail(input.email);
  assertPassword(input.password);

  const now = new Date().toISOString();
  const client: Client = {
    id: crypto.randomUUID(),
    fullName: normalizeText(input.fullName),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    password: input.password.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const { database, transaction, store } = await getStore("readwrite");
  await requestResult(store.put(client));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo registrar el cliente."));
    };
  });

  return client;
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const clients = await listClients();
  const client = clients.find((item) => item.id === id);

  if (!client) {
    throw new Error("Cliente no encontrado.");
  }

  const updated: Client = {
    ...client,
    fullName: input.fullName ? normalizeText(input.fullName) : client.fullName,
    email: input.email ? normalizeEmail(input.email) : client.email,
    phone: input.phone ? normalizePhone(input.phone) : client.phone,
    password: input.password ? input.password.trim() : client.password,
    status: input.status ?? client.status,
    updatedAt: new Date().toISOString(),
  };

  if (updated.password.length < 4) {
    throw new Error("La clave debe tener al menos 4 caracteres.");
  }

  if (!updated.email.includes("@")) {
    throw new Error("El correo no es valido.");
  }

  const { database, transaction, store } = await getStore("readwrite");
  await requestResult(store.put(updated));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo actualizar el cliente."));
    };
  });

  return updated;
}

export async function approveClient(id: string): Promise<Client> {
  return updateClient(id, { status: "approved" });
}

export async function rejectClient(id: string): Promise<Client> {
  return updateClient(id, { status: "rejected" });
}

export async function resetClientPassword(id: string, password: string): Promise<Client> {
  return updateClient(id, { password });
}

export async function authenticateClient(email: string, password: string): Promise<Client | null> {
  const clients = await listClients();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = password.trim();
  return clients.find(
    (client) => client.email === normalizedEmail && client.password === normalizedPassword && client.status === "approved",
  ) ?? null;
}
