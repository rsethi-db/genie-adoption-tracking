import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FINS_ACCOUNTS, type FinsAccount } from "@/lib/fins-accounts";

// Searchable dropdown over the real FINS customer accounts (from GTM). Picking an
// account emits the full record so the dialog can auto-populate AE / SA / DSA /
// sub-vertical. Users can still type a custom name not in the list (nothing blocked).
export function AccountCombobox({
  value,
  onChange,
  onSelectAccount,
  placeholder = "Select or search an account…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectAccount?: (account: FinsAccount | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trimmed = search.trim();
  const showCustom =
    trimmed.length > 0 &&
    !FINS_ACCOUNTS.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn(!value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search accounts…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matching FINS account.</CommandEmpty>
            {showCustom && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={trimmed}
                  onSelect={() => {
                    onChange(trimmed);
                    onSelectAccount?.(null);
                    setOpen(false);
                  }}
                >
                  Use "{trimmed}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="FINS accounts">
              {FINS_ACCOUNTS.map((account) => (
                <CommandItem
                  key={account.name}
                  value={account.name}
                  onSelect={() => {
                    const isClear = account.name === value;
                    onChange(isClear ? "" : account.name);
                    onSelectAccount?.(isClear ? null : account);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === account.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1">{account.name}</span>
                  {account.ae && (
                    <span className="ml-2 text-xs text-muted-foreground truncate max-w-[40%]">
                      {account.ae}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AccountCombobox;
