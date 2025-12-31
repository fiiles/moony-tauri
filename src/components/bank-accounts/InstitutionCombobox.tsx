import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { bankAccountsApi } from "@/lib/tauri-api";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Institution } from "@shared/schema";

interface InstitutionComboboxProps {
  institutions: Institution[];
  value: string | null;
  onChange: (value: string | null) => void;
}

export function InstitutionCombobox({
  institutions,
  value,
  onChange,
}: InstitutionComboboxProps) {
  const { t } = useTranslation("bank_accounts");
  const { t: tc } = useTranslation("common");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Find selected institution
  const selectedInstitution = useMemo(() => {
    return institutions.find((inst) => inst.id === value) || null;
  }, [institutions, value]);

  // Filter institutions by search
  const filteredInstitutions = useMemo(() => {
    if (!search) return institutions;
    const searchLower = search.toLowerCase();
    return institutions.filter((inst) =>
      inst.name.toLowerCase().includes(searchLower)
    );
  }, [institutions, search]);

  const handleCreateNewBank = async () => {
    if (!newBankName.trim()) return;

    setIsCreating(true);
    try {
      const newInstitution = await bankAccountsApi.createInstitution(newBankName.trim());
      // Refetch institutions
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      // Select the newly created institution
      onChange(newInstitution.id);
      setAddDialogOpen(false);
      setNewBankName("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to create institution:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenAddDialog = () => {
    // Pre-fill with search term if user was searching
    setNewBankName(search);
    setAddDialogOpen(true);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 font-normal bg-background hover:bg-background"
          >
            <span className="truncate">
              {selectedInstitution ? (
                selectedInstitution.name
              ) : (
                <span className="text-muted-foreground">
                  {t("form.selectBank", "Select a bank...")}
                </span>
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("form.searchBank", "Search bank...")}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {t("form.noBankFound", "No bank found.")}
              </CommandEmpty>
              <ScrollArea className="h-[200px]">
                <CommandGroup>
                  {/* None option */}
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground">—</span>
                  </CommandItem>
                  {/* Institution list - show all */}
                  {filteredInstitutions.map((inst) => (
                    <CommandItem
                      key={inst.id}
                      value={inst.id}
                      onSelect={() => {
                        onChange(inst.id);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === inst.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {inst.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem onSelect={handleOpenAddDialog} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("form.addNewBank", "Add new bank...")}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Add New Bank Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("form.addNewBank", "Add New Bank")}</DialogTitle>
            <DialogDescription>
              {t("form.addNewBankDesc", "Enter the name of the bank to add.")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bankName">{t("fields.bankName", "Bank Name")}</Label>
              <Input
                id="bankName"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                placeholder={t("form.bankNamePlaceholder", "e.g. Česká spořitelna")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateNewBank();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {tc("actions.cancel")}
            </Button>
            <Button onClick={handleCreateNewBank} disabled={!newBankName.trim() || isCreating}>
              {isCreating ? tc("status.saving") : tc("actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
