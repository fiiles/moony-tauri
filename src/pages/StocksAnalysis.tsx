import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockTagsApi } from "@/lib/tauri-api";
import { SummaryCard } from "@/components/common/SummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/components/ui/command";
import { TrendingUp, TrendingDown, PieChart, Tag, Plus, Trash2, Settings2, FolderOpen, X, MoveRight, Check, ChevronsUpDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { StockTag, StockTagGroup, StockInvestmentWithTags, TagMetrics } from "@shared/schema";

// Chart color tokens for tag palette
const TAG_COLORS = [
    'hsl(var(--chart-8))', // blue
    'hsl(var(--chart-6))', // green
    'hsl(var(--chart-7))', // amber
    'hsl(var(--destructive))', // red
    'hsl(var(--chart-1))', // violet
    'hsl(var(--chart-4))', // pink
    'hsl(var(--chart-3))', // cyan-ish
    'hsl(var(--chart-2))', // orange-ish
];

export default function StocksAnalysis() {
    const { t } = useTranslation('reports');
    const { t: tc } = useTranslation('common');
    const { formatCurrency } = useCurrency();
    const formatPercent = (value: number) => `${value.toFixed(1)}%`;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
    const [newTagGroupId, setNewTagGroupId] = useState<string>("");
    const [isCreateTagDialogOpen, setIsCreateTagDialogOpen] = useState(false);
    const [assignTagIds, setAssignTagIds] = useState<string[]>([]);
    const [assignTagsOpen, setAssignTagsOpen] = useState(false);
    // Group management state
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupDescription, setNewGroupDescription] = useState("");
    const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
    // Filter state - select group first, then tags
    const [filterGroupId, setFilterGroupId] = useState<string>("all");
    // Tag-to-group assignment state
    const [moveTagId, setMoveTagId] = useState<string>("");
    const [moveToGroupId, setMoveToGroupId] = useState<string>("");

    // Queries
    const { data: tags = [], isLoading: tagsLoading } = useQuery<StockTag[]>({
        queryKey: ["stock-tags"],
        queryFn: stockTagsApi.getAll,
    });

    const { data: groups = [], isLoading: groupsLoading } = useQuery<StockTagGroup[]>({
        queryKey: ["stock-tag-groups"],
        queryFn: stockTagsApi.getAllGroups,
    });

    const { data: stocks = [], isLoading: stocksLoading } = useQuery<StockInvestmentWithTags[]>({
        queryKey: ["stocks-analysis"],
        queryFn: stockTagsApi.getAnalysis,
    });

    const { data: metrics = [], isLoading: metricsLoading } = useQuery<TagMetrics[]>({
        queryKey: ["tag-metrics", selectedTagIds],
        queryFn: () => stockTagsApi.getTagMetrics(selectedTagIds),
    });

    // Tag Mutations
    const createTagMutation = useMutation({
        mutationFn: stockTagsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-tags"] });
            queryClient.invalidateQueries({ queryKey: ["tag-metrics"] });
            setNewTagName("");
            setNewTagGroupId("");
            setIsCreateTagDialogOpen(false);
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    const updateTagMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name: string; color?: string | null; groupId?: string | null } }) =>
            stockTagsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-tags"] });
            setMoveTagId("");
            setMoveToGroupId("");
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    const deleteTagMutation = useMutation({
        mutationFn: stockTagsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-tags"] });
            queryClient.invalidateQueries({ queryKey: ["stocks-analysis"] });
            queryClient.invalidateQueries({ queryKey: ["tag-metrics"] });
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    const setTagsMutation = useMutation({
        mutationFn: ({ investmentId, tagIds }: { investmentId: string; tagIds: string[] }) =>
            stockTagsApi.setForInvestment(investmentId, tagIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stocks-analysis"] });
            queryClient.invalidateQueries({ queryKey: ["tag-metrics"] });
            setSelectedStockIds([]);
            setAssignTagIds([]);
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    // Group Mutations
    const createGroupMutation = useMutation({
        mutationFn: stockTagsApi.createGroup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-tag-groups"] });
            setNewGroupName("");
            setNewGroupDescription("");
            setIsCreateGroupDialogOpen(false);
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    const deleteGroupMutation = useMutation({
        mutationFn: stockTagsApi.deleteGroup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stock-tag-groups"] });
            queryClient.invalidateQueries({ queryKey: ["stock-tags"] });
            toast({ title: tc('status.success') });
        },
        onError: (error: Error) => {
            toast({ title: tc('status.error'), description: error.message, variant: 'destructive' });
        },
    });

    // Handlers
    const handleCreateTag = () => {
        if (newTagName.trim()) {
            createTagMutation.mutate({ 
                name: newTagName.trim(), 
                color: newTagColor,
                groupId: newTagGroupId && newTagGroupId !== "none" ? newTagGroupId : null
            });
        }
    };

    const handleCreateGroup = () => {
        if (newGroupName.trim()) {
            createGroupMutation.mutate({
                name: newGroupName.trim(),
                description: newGroupDescription.trim() || null
            });
        }
    };

    const handleDeleteTag = (id: string) => {
        deleteTagMutation.mutate(id);
    };

    const handleDeleteGroup = (id: string) => {
        deleteGroupMutation.mutate(id);
    };

    const handleMoveTagToGroup = () => {
        if (!moveTagId) return;
        const tag = tags.find(t => t.id === moveTagId);
        if (tag) {
            updateTagMutation.mutate({
                id: moveTagId,
                data: {
                    name: tag.name,
                    color: tag.color,
                    groupId: moveToGroupId || null
                }
            });
        }
    };

    const handleToggleTagFilter = (tagId: string) => {
        setSelectedTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleToggleStockSelection = (stockId: string) => {
        setSelectedStockIds(prev =>
            prev.includes(stockId)
                ? prev.filter(id => id !== stockId)
                : [...prev, stockId]
        );
    };

    const handleSelectAllStocks = () => {
        if (selectedStockIds.length === stocks.length) {
            setSelectedStockIds([]);
        } else {
            setSelectedStockIds(stocks.map(s => s.id));
        }
    };

    const handleAssignTagsToSelected = () => {
        if (assignTagIds.length === 0 || selectedStockIds.length === 0) return;

        // For each selected stock, add all selected tags to their existing tags
        selectedStockIds.forEach(stockId => {
            const stock = stocks.find(s => s.id === stockId);
            if (stock) {
                const existingTagIds = stock.tags.map(t => t.id);
                // Merge existing tags with new tags, avoiding duplicates
                const newTagIds = [...new Set([...existingTagIds, ...assignTagIds])];
                // Only mutate if there are new tags to add
                if (newTagIds.length > existingTagIds.length) {
                    setTagsMutation.mutate({
                        investmentId: stockId,
                        tagIds: newTagIds
                    });
                }
            }
        });
    };

    const handleToggleAssignTag = (tagId: string) => {
        setAssignTagIds(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleRemoveTagFromStock = (stockId: string, tagId: string) => {
        const stock = stocks.find(s => s.id === stockId);
        if (stock) {
            const newTagIds = stock.tags.filter(t => t.id !== tagId).map(t => t.id);
            setTagsMutation.mutate({
                investmentId: stockId,
                tagIds: newTagIds
            });
        }
    };

    // Calculate totals
    const totalPortfolioValue = stocks.reduce((sum, s) => sum + s.currentValue, 0);
    const filteredMetrics = selectedTagIds.length > 0
        ? metrics.filter(m => selectedTagIds.includes(m.tag.id))
        : metrics;

    const isLoading = tagsLoading || stocksLoading || metricsLoading || groupsLoading;

    return (
        <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="page-title">{t('stocksAnalysis.title')}</h1>
                    <p className="page-subtitle">{t('stocksAnalysis.subtitle')}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManagementOpen(prev => !prev)}
                >
                    <Settings2 className="h-4 w-4 mr-2" />
                    {t('stocksAnalysis.manageTags')}
                </Button>
            </div>

            {/* Tag Management Section - positioned right below header like Budgeting page */}
            {isManagementOpen && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <CardTitle>{t('stocksAnalysis.tagManagement')}</CardTitle>
                                <CardDescription>{t('stocksAnalysis.tagManagementDescription')}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(true)}>
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    {t('stocksAnalysis.createGroup')}
                                </Button>
                                <Button onClick={() => setIsCreateTagDialogOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('stocksAnalysis.createTag')}
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setIsManagementOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Groups and Tags organized */}
                        {groups.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium">{t('stocksAnalysis.tagGroups')}</h3>
                                {groups.map(group => (
                                    <div key={group.id} className="border rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{group.name}</span>
                                                {group.description && (
                                                    <span className="text-xs text-muted-foreground">– {group.description}</span>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 hover:bg-destructive/20"
                                                onClick={() => handleDeleteGroup(group.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 pl-6">
                                            {tags.filter(t => t.groupId === group.id).map(tag => (
                                                <Badge
                                                    key={tag.id}
                                                    variant="secondary"
                                                    className="h-7 px-3 flex items-center gap-1"
                                                    style={{ borderColor: tag.color || undefined }}
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                                    />
                                                    {tag.name}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20"
                                                        onClick={() => handleDeleteTag(tag.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </Badge>
                                            ))}
                                            {tags.filter(t => t.groupId === group.id).length === 0 && (
                                                <span className="text-xs text-muted-foreground">{t('stocksAnalysis.noTagsInGroup')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Ungrouped Tags with move-to-group functionality */}
                        {tags.filter(t => !t.groupId).length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium">{t('stocksAnalysis.ungroupedTags')}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {tags.filter(t => !t.groupId).map(tag => (
                                        <Badge
                                            key={tag.id}
                                            variant="secondary"
                                            className="h-7 px-3 flex items-center gap-1"
                                            style={{ borderColor: tag.color || undefined }}
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                            />
                                            {tag.name}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20"
                                                onClick={() => handleDeleteTag(tag.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </Badge>
                                    ))}
                                </div>
                                
                                {/* Move tag to group */}
                                {groups.length > 0 && (
                                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                        <MoveRight className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{t('stocksAnalysis.moveToGroup')}:</span>
                                        <Select value={moveTagId} onValueChange={setMoveTagId}>
                                            <SelectTrigger className="w-40 bg-white dark:bg-zinc-900 border">
                                                <SelectValue placeholder={t('stocksAnalysis.selectTag')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tags.filter(t => !t.groupId).map(tag => (
                                                    <SelectItem key={tag.id} value={tag.id}>
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                                            />
                                                            {tag.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select value={moveToGroupId} onValueChange={setMoveToGroupId}>
                                            <SelectTrigger className="w-40 bg-white dark:bg-zinc-900 border">
                                                <SelectValue placeholder={t('stocksAnalysis.selectGroup')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groups.map(group => (
                                                    <SelectItem key={group.id} value={group.id}>
                                                        <div className="flex items-center gap-2">
                                                            <FolderOpen className="h-3 w-3" />
                                                            {group.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            size="sm"
                                            onClick={handleMoveTagToGroup}
                                            disabled={!moveTagId || !moveToGroupId || updateTagMutation.isPending}
                                        >
                                            {t('stocksAnalysis.move')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bulk Assignment */}
                        {selectedStockIds.length > 0 && (
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg flex-wrap">
                                <span className="text-sm">
                                    {selectedStockIds.length} {t('stocksAnalysis.stocksSelected')}
                                </span>
                                <Popover open={assignTagsOpen} onOpenChange={setAssignTagsOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={assignTagsOpen}
                                            className="w-64 justify-between bg-white dark:bg-zinc-900 border"
                                        >
                                            {assignTagIds.length > 0
                                                ? `${assignTagIds.length} ${t('stocksAnalysis.tags').toLowerCase()}`
                                                : t('stocksAnalysis.selectTags')}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder={t('stocksAnalysis.searchTags')} />
                                            <CommandList>
                                                <CommandEmpty>{t('stocksAnalysis.noTagsFound')}</CommandEmpty>
                                                <CommandGroup>
                                                    {tags.map(tag => (
                                                        <CommandItem
                                                            key={tag.id}
                                                            value={tag.name}
                                                            onSelect={() => handleToggleAssignTag(tag.id)}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    assignTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <span
                                                                className="w-3 h-3 rounded-full mr-2"
                                                                style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                                            />
                                                            {tag.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                {assignTagIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {assignTagIds.map(tagId => {
                                            const tag = tags.find(t => t.id === tagId);
                                            return tag ? (
                                                <Badge
                                                    key={tagId}
                                                    variant="secondary"
                                                    className="h-6 px-2 flex items-center gap-1"
                                                    style={{ borderColor: tag.color || undefined }}
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                                    />
                                                    {tag.name}
                                                    <button
                                                        type="button"
                                                        className="ml-1 hover:text-destructive"
                                                        onClick={() => handleToggleAssignTag(tagId)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                                <Button
                                    size="sm"
                                    onClick={handleAssignTagsToSelected}
                                    disabled={assignTagIds.length === 0 || setTagsMutation.isPending}
                                >
                                    {t('stocksAnalysis.assignTags')}
                                </Button>
                            </div>
                        )}

                        {/* Holdings Table */}
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedStockIds.length === stocks.length && stocks.length > 0}
                                                onCheckedChange={handleSelectAllStocks}
                                            />
                                        </TableHead>
                                        <TableHead>{t('stocksAnalysis.stock')}</TableHead>
                                        <TableHead className="text-right">{t('stocksAnalysis.value')}</TableHead>
                                        <TableHead className="text-right">{t('stocksAnalysis.gainLoss')}</TableHead>
                                        <TableHead>{t('stocksAnalysis.tags')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                {tc('status.loading')}
                                            </TableCell>
                                        </TableRow>
                                    ) : stocks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                {t('stocksAnalysis.noStocks')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        stocks.map(stock => (
                                            <TableRow key={stock.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedStockIds.includes(stock.id)}
                                                        onCheckedChange={() => handleToggleStockSelection(stock.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium">{stock.companyName}</div>
                                                        <div className="text-sm text-muted-foreground">{stock.ticker}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(stock.currentValue)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={stock.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {formatCurrency(stock.gainLoss)}
                                                        <br />
                                                        <span className="text-xs">
                                                            ({formatPercent(stock.gainLossPercent)})
                                                        </span>
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {stock.tags.map(tag => (
                                                            <Badge
                                                                key={tag.id}
                                                                variant="secondary"
                                                                className="text-xs cursor-pointer hover:bg-destructive/20 h-6"
                                                                style={{ borderColor: tag.color || undefined }}
                                                                onClick={() => handleRemoveTagFromStock(stock.id, tag.id)}
                                                            >
                                                                <span
                                                                    className="w-2 h-2 rounded-full mr-1"
                                                                    style={{ backgroundColor: tag.color || 'hsl(var(--chart-8))' }}
                                                                />
                                                                {tag.name}
                                                                <span className="ml-1">×</span>
                                                            </Badge>
                                                        ))}
                                                        {stock.tags.length === 0 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {t('stocksAnalysis.noTags')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Overview Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title={t('stocksAnalysis.totalPortfolioValue')}
                    value={formatCurrency(totalPortfolioValue)}
                    icon={<PieChart className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('stocksAnalysis.tagsCreated')}
                    value={tags.length.toString()}
                    subtitle={`${groups.length} ${t('stocksAnalysis.groups')}`}
                    icon={<Tag className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('stocksAnalysis.taggedHoldings')}
                    value={stocks.filter(s => s.tags.length > 0).length.toString()}
                    subtitle={`${t('stocksAnalysis.of')} ${stocks.length} ${t('stocksAnalysis.total')}`}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <SummaryCard
                    title={t('stocksAnalysis.untaggedHoldings')}
                    value={stocks.filter(s => s.tags.length === 0).length.toString()}
                    icon={<TrendingDown className="h-4 w-4" />}
                />
            </div>

            {/* Tag Filter Section - Group dropdown on row 1, tags on row 2 */}
            {tags.length > 0 && (
                <div className="space-y-3">
                    {/* Row 1: Group filter dropdown */}
                    {groups.length > 0 && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{t('stocksAnalysis.filterByGroup')}:</span>
                            <Select value={filterGroupId} onValueChange={setFilterGroupId}>
                                <SelectTrigger className="w-48 bg-white dark:bg-zinc-900 border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('stocksAnalysis.allTags')}</SelectItem>
                                    {groups.map(group => (
                                        <SelectItem key={group.id} value={group.id}>
                                            <div className="flex items-center gap-2">
                                                <FolderOpen className="h-3 w-3" />
                                                {group.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="ungrouped">{t('stocksAnalysis.ungroupedTags')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    
                    {/* Row 2: Tag chips - filtered by group selection */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">{t('stocksAnalysis.filterByTag')}:</span>
                        {(filterGroupId === "all" 
                            ? tags 
                            : filterGroupId === "ungrouped" 
                                ? tags.filter(t => !t.groupId) 
                                : tags.filter(t => t.groupId === filterGroupId)
                        ).map(tag => (
                            <Badge
                                key={tag.id}
                                variant={selectedTagIds.includes(tag.id) ? "default" : "secondary"}
                                className="cursor-pointer transition-all h-7 px-3"
                                style={{
                                    backgroundColor: selectedTagIds.includes(tag.id) ? tag.color || undefined : undefined,
                                    borderColor: tag.color || undefined,
                                }}
                                onClick={() => handleToggleTagFilter(tag.id)}
                            >
                                <span
                                    className="w-2 h-2 rounded-full mr-1.5"
                                    style={{ backgroundColor: selectedTagIds.includes(tag.id) ? '#fff' : tag.color || 'hsl(var(--chart-8))' }}
                                />
                                {tag.name}
                            </Badge>
                        ))}
                        {selectedTagIds.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setSelectedTagIds([])}
                            >
                                {tc('buttons.clearAll')}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Stacked Bar Chart for Tag Metrics */}
            {filteredMetrics.length > 0 && (() => {
                // Calculate totals for each metric to compute percentages
                const totalValue = filteredMetrics.reduce((sum, m) => sum + m.totalValue, 0);
                const totalGainLoss = filteredMetrics.reduce((sum, m) => sum + Math.abs(m.gainLoss), 0);
                const totalDividend = filteredMetrics.reduce((sum, m) => sum + m.estimatedYearlyDividend, 0);

                // Create data with percentages
                const chartData = [
                    {
                        metric: t('stocksAnalysis.totalValue'),
                        total: totalValue,
                        ...Object.fromEntries(filteredMetrics.map(m => [
                            m.tag.id, 
                            totalValue > 0 ? (m.totalValue / totalValue) * 100 : 0
                        ])),
                        // Store raw values for tooltip
                        rawValues: Object.fromEntries(filteredMetrics.map(m => [m.tag.id, m.totalValue]))
                    },
                    {
                        metric: t('stocksAnalysis.gainLoss'),
                        total: totalGainLoss,
                        ...Object.fromEntries(filteredMetrics.map(m => [
                            m.tag.id, 
                            totalGainLoss > 0 ? (Math.abs(m.gainLoss) / totalGainLoss) * 100 : 0
                        ])),
                        rawValues: Object.fromEntries(filteredMetrics.map(m => [m.tag.id, Math.abs(m.gainLoss)]))
                    },
                    {
                        metric: t('stocksAnalysis.yearlyDividend'),
                        total: totalDividend,
                        ...Object.fromEntries(filteredMetrics.map(m => [
                            m.tag.id, 
                            totalDividend > 0 ? (m.estimatedYearlyDividend / totalDividend) * 100 : 0
                        ])),
                        rawValues: Object.fromEntries(filteredMetrics.map(m => [m.tag.id, m.estimatedYearlyDividend]))
                    },
                ];

                return (
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4">{t('stocksAnalysis.metricsChart')}</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis 
                                    dataKey="metric" 
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis 
                                    tickFormatter={(value) => `${Math.round(value)}%`}
                                    domain={[0, 100]}
                                    ticks={[0, 25, 50, 75, 100]}
                                    allowDataOverflow={true}
                                    stroke="hsl(var(--muted-foreground))"
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload || payload.length === 0) return null;
                                        const dataItem = chartData.find(d => d.metric === label);
                                        return (
                                            <div className="bg-popover border border-border rounded-md p-3 shadow-lg">
                                                <p className="font-medium mb-2">{label}</p>
                                                {payload.map((entry) => {
                                                    const tag = filteredMetrics.find(m => m.tag.id === entry.dataKey);
                                                    const rawValue = dataItem?.rawValues?.[entry.dataKey as string] || 0;
                                                    const percent = entry.value as number;
                                                    return (
                                                        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                                                            <span 
                                                                className="w-3 h-3 rounded-sm" 
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            <span className="text-muted-foreground">{tag?.tag.name}:</span>
                                                            <span className="font-medium">{percent.toFixed(1)}%</span>
                                                            <span className="text-muted-foreground">({formatCurrency(rawValue)})</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }}
                                />
                                <Legend 
                                    formatter={(value: string) => {
                                        const tag = filteredMetrics.find(m => m.tag.id === value);
                                        return <span className="text-sm">{tag?.tag.name || value}</span>;
                                    }}
                                    wrapperStyle={{ paddingTop: '20px' }}
                                />
                                {filteredMetrics.map(m => (
                                    <Bar 
                                        key={m.tag.id}
                                        dataKey={m.tag.id} 
                                        stackId="a" 
                                        fill={m.tag.color || 'hsl(var(--chart-8))'} 
                                        name={m.tag.id}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                );
            })()}

            {/* Tag Metrics Cards */}
            {filteredMetrics.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">{t('stocksAnalysis.tagBreakdown')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMetrics.map(metric => (
                            <Card key={metric.tag.id} className="overflow-hidden">
                                <div
                                    className="h-1"
                                    style={{ backgroundColor: metric.tag.color || 'hsl(var(--chart-8))' }}
                                />
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Tag className="h-4 w-4" style={{ color: metric.tag.color || undefined }} />
                                        {metric.tag.name}
                                    </CardTitle>
                                    <CardDescription>
                                        {metric.holdingsCount} {t('stocksAnalysis.holdings')} • {formatPercent(metric.portfolioPercent)} {t('stocksAnalysis.ofPortfolio')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">{t('stocksAnalysis.totalValue')}</span>
                                        <span className="font-medium">{formatCurrency(metric.totalValue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">{t('stocksAnalysis.gainLoss')}</span>
                                        <span className={`font-medium ${metric.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(metric.gainLoss)} ({formatPercent(metric.gainLossPercent)})
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">{t('stocksAnalysis.yearlyDividend')}</span>
                                        <span className="font-medium">{formatCurrency(metric.estimatedYearlyDividend)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Tag Dialog */}
            <Dialog open={isCreateTagDialogOpen} onOpenChange={setIsCreateTagDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('stocksAnalysis.createTag')}</DialogTitle>
                        <DialogDescription>
                            {t('stocksAnalysis.createTagDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('stocksAnalysis.tagName')}</label>
                            <Input
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder={t('stocksAnalysis.tagNamePlaceholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('stocksAnalysis.tagColor')}</label>
                            <div className="flex gap-2">
                                {TAG_COLORS.map(color => (
                                    <button
                                        key={color}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                                            newTagColor === color ? 'border-foreground scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setNewTagColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                        {groups.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('stocksAnalysis.assignToGroup')}</label>
                                <Select value={newTagGroupId} onValueChange={setNewTagGroupId}>
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border">
                                        <SelectValue placeholder={t('stocksAnalysis.selectGroupOptional')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t('stocksAnalysis.noGroup')}</SelectItem>
                                        {groups.map(group => (
                                            <SelectItem key={group.id} value={group.id}>
                                                <div className="flex items-center gap-2">
                                                    <FolderOpen className="h-3 w-3" />
                                                    {group.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateTagDialogOpen(false)}>
                            {tc('buttons.cancel')}
                        </Button>
                        <Button
                            onClick={handleCreateTag}
                            disabled={!newTagName.trim() || createTagMutation.isPending}
                        >
                            {createTagMutation.isPending ? tc('status.loading') : tc('buttons.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Group Dialog */}
            <Dialog open={isCreateGroupDialogOpen} onOpenChange={setIsCreateGroupDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('stocksAnalysis.createGroup')}</DialogTitle>
                        <DialogDescription>
                            {t('stocksAnalysis.createGroupDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('stocksAnalysis.groupName')}</label>
                            <Input
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                placeholder={t('stocksAnalysis.groupNamePlaceholder')}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('stocksAnalysis.groupDescription')}</label>
                            <Input
                                value={newGroupDescription}
                                onChange={(e) => setNewGroupDescription(e.target.value)}
                                placeholder={t('stocksAnalysis.groupDescriptionPlaceholder')}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateGroupDialogOpen(false)}>
                            {tc('buttons.cancel')}
                        </Button>
                        <Button
                            onClick={handleCreateGroup}
                            disabled={!newGroupName.trim() || createGroupMutation.isPending}
                        >
                            {createGroupMutation.isPending ? tc('status.loading') : tc('buttons.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
