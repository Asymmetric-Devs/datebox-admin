"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  CalendarPlus,
  Store,
  MapPin,
  Image as ImageIcon,
  Tag,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";

export default function NewEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    venue_name: "",
    category: "Gastronomía",
    address: "",
    latitude: "",
    longitude: "",
    description: "",
    is_temporary: false,
    status: true,
  });

  const [imageUrls, setImageUrls] = useState<string[]>([""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddImageField = () => {
    setImageUrls([...imageUrls, ""]);
  };

  const handleImageChange = (index: number, val: string) => {
    const next = [...imageUrls];
    next[index] = val;
    setImageUrls(next);
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const createEventMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      setSuccessMessage(null);

      if (!form.title.trim()) {
        throw new Error("El título del lugar o evento es obligatorio.");
      }

      const validImages = imageUrls.filter((url) => url.trim().length > 0);

      const payload = {
        title: form.title.trim(),
        venue_name: form.venue_name.trim() || form.title.trim(),
        category: form.category,
        address: form.address.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        description: form.description.trim() || null,
        is_temporary: form.is_temporary,
        status: form.status,
        image_urls: validImages,
      };

      const { data, error } = await supabase.from("events").insert([payload]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-catalog-stats"] });
      setSuccessMessage(`¡"${data.title}" creado con éxito en DateBox!`);
      setTimeout(() => {
        router.push("/catalog");
      }, 1500);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || "Error al crear el evento");
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-heading text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Alta Directa de Lugares y Eventos
          </h1>
          <Badge variant="purple">
            <Sparkles className="w-3 h-3" /> Manual Ingest
          </Badge>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Carga directa de venues, restaurantes o eventos especiales para enriquecer el catálogo de DateBox.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 p-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 p-3 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createEventMutation.mutate();
        }}
        className="space-y-6"
      >
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Información Principal</CardTitle>
            <CardDescription>Nombre, categoría y tipo de publicación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Título del Evento o Lugar"
                placeholder="Ej: Don Julio Parrilla"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <Input
                label="Nombre del Local / Establecimiento"
                placeholder="Ej: Don Julio"
                value={form.venue_name}
                onChange={(e) => setForm({ ...form, venue_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Categoría"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Gastronomía">Gastronomía</option>
                <option value="Bares & Tragos">Bares & Tragos</option>
                <option value="Cafeterías">Cafeterías</option>
                <option value="Música & Recitales">Música & Recitales</option>
                <option value="Teatro & Cultura">Teatro & Cultura</option>
                <option value="Boliches & Fiestas">Boliches & Fiestas</option>
                <option value="Deportes & Aire Libre">Deportes & Aire Libre</option>
                <option value="Entretenimiento">Entretenimiento</option>
              </Select>

              <Select
                label="Tipo de Publicación"
                value={form.is_temporary ? "event" : "place"}
                onChange={(e) => setForm({ ...form, is_temporary: e.target.value === "event" })}
              >
                <option value="place">Local / Establecimiento Permanente</option>
                <option value="event">Evento Temporal / Función Especial</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Descripción detallada
              </label>
              <textarea
                rows={4}
                placeholder="Describe la experiencia, carta, horarios o detalles especiales..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Ubicación y Coordenadas</CardTitle>
            <CardDescription>Georreferenciación para recomendaciones por cercanía</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Dirección Completa"
              placeholder="Ej: Guatemala 4699, Palermo, CABA"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Latitud"
                type="number"
                step="any"
                placeholder="-34.5885"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              />
              <Input
                label="Longitud"
                type="number"
                step="any"
                placeholder="-58.4238"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Images Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">3. Galería de Imágenes</CardTitle>
                <CardDescription>URLs de fotografías en alta calidad</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddImageField} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Agregar URL
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {imageUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="https://images.unsplash.com/..."
                  value={url}
                  onChange={(e) => handleImageChange(index, e.target.value)}
                />
                {imageUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveImage(index)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => router.push("/catalog")}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" isLoading={createEventMutation.isPending} className="gap-2">
            <CalendarPlus className="w-4 h-4" />
            Publicar en DateBox
          </Button>
        </div>
      </form>
    </div>
  );
}
