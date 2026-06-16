declare namespace chrome {
  namespace runtime {
    interface LastError {
      message: string;
    }

    const lastError: LastError | undefined;

    function openOptionsPage(callback: () => void): void;
  }

  namespace storage {
    namespace local {
      function get(
        keys: string | string[] | Record<string, unknown>,
        callback: (items: Record<string, unknown>) => void
      ): void;
      function set(items: Record<string, unknown>, callback: () => void): void;
      function remove(keys: string | string[], callback: () => void): void;
    }

    const onChanged: {
      addListener(callback: (changes: Record<string, unknown>, areaName: string) => void): void;
      removeListener(callback: (changes: Record<string, unknown>, areaName: string) => void): void;
    };
  }
}
