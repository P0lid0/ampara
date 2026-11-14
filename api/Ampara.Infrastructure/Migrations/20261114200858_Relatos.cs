using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Relatos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Relatos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AutorId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tipo = table.Column<string>(type: "text", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lng = table.Column<double>(type: "double precision", nullable: false),
                    AreaId = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Texto = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Relatos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Relatos_Usuarios_AutorId",
                        column: x => x.AutorId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RelatoConfirmacoes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RelatoId = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RelatoConfirmacoes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RelatoConfirmacoes_Relatos_RelatoId",
                        column: x => x.RelatoId,
                        principalTable: "Relatos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RelatoConfirmacoes_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RelatoConfirmacoes_RelatoId_UsuarioId",
                table: "RelatoConfirmacoes",
                columns: new[] { "RelatoId", "UsuarioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RelatoConfirmacoes_UsuarioId",
                table: "RelatoConfirmacoes",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Relatos_AutorId_CriadoEm",
                table: "Relatos",
                columns: new[] { "AutorId", "CriadoEm" });

            migrationBuilder.CreateIndex(
                name: "IX_Relatos_Em",
                table: "Relatos",
                column: "Em");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RelatoConfirmacoes");

            migrationBuilder.DropTable(
                name: "Relatos");
        }
    }
}
