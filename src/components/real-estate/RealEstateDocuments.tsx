import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { realEstateApi } from "@/lib/tauri-api";
import type { RealEstateDocument } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
    Plus,
    FileText,
    File,
    ExternalLink,
    Trash2,
    FileCheck,
    Home,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddRealEstateDocumentModal } from "./AddRealEstateDocumentModal";
import { format } from "date-fns";

interface RealEstateDocumentsProps {
    realEstateId: string;
}

const getDocumentIcon = (fileType: string) => {
    switch (fileType) {
        case 'deed':
            return <Home className="h-5 w-5 text-blue-500" />;
        case 'contract':
            return <FileText className="h-5 w-5 text-green-500" />;
        case 'appraisal':
            return <FileCheck className="h-5 w-5 text-amber-500" />;
        default:
            return <File className="h-5 w-5 text-gray-500" />;
    }
};

const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function RealEstateDocuments({ realEstateId }: RealEstateDocumentsProps) {
    const { t } = useTranslation('realEstate');
    const { t: tc } = useTranslation('common');
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [deletingDocument, setDeletingDocument] = useState<RealEstateDocument | null>(null);

    const { data: documents, isLoading } = useQuery<RealEstateDocument[]>({
        queryKey: ["real-estate-documents", realEstateId],
        queryFn: () => realEstateApi.getDocuments(realEstateId),
    });

    const deleteMutation = useMutation({
        mutationFn: (documentId: string) => realEstateApi.deleteDocument(documentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["real-estate-documents", realEstateId] });
            setDeletingDocument(null);
            toast({
                title: tc('status.success'),
                description: t('documents.deleted'),
            });
        },
        onError: (error) => {
            toast({
                title: tc('status.error'),
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const openDocument = async (documentId: string) => {
        try {
            await realEstateApi.openDocument(documentId);
        } catch (error) {
            toast({
                title: tc('status.error'),
                description: String(error),
                variant: "destructive",
            });
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('documents.title')}</CardTitle>
                        <CardDescription>{t('documents.description')}</CardDescription>
                    </div>
                    <Button onClick={() => setAddModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> {t('documents.add')}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground">{t('loading')}</p>
                    ) : documents && documents.length > 0 ? (
                        <div className="space-y-2">
                            {documents.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        {getDocumentIcon(doc.fileType)}
                                        <div>
                                            <p className="font-medium">{doc.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="capitalize">{t(`documents.types.${doc.fileType}`) || doc.fileType}</span>
                                                {doc.fileSize && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{formatFileSize(doc.fileSize)}</span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span>{format(new Date(doc.uploadedAt * 1000), "PP")}</span>
                                            </div>
                                            {doc.description && (
                                                <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDocument(doc.id)}
                                            title={t('documents.open')}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setDeletingDocument(doc)}
                                            title={t('documents.delete')}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-2 text-sm text-muted-foreground">{t('documents.noDocuments')}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-4"
                                onClick={() => setAddModalOpen(true)}
                            >
                                <Plus className="mr-2 h-4 w-4" /> {t('documents.addFirst')}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Document Modal */}
            <AddRealEstateDocumentModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                realEstateId={realEstateId}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingDocument} onOpenChange={(open) => !open && setDeletingDocument(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('documents.deleteConfirm.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('documents.deleteConfirm.description', { name: deletingDocument?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{tc('buttons.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deletingDocument && deleteMutation.mutate(deletingDocument.id)}
                        >
                            {tc('buttons.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
