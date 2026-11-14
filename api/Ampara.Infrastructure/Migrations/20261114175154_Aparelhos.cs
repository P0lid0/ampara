using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Aparelhos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Aparelhos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImeiCifrado = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ImeiFinal = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    Marca = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Modelo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Aparelhos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Aparelhos_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Aparelhos_UsuarioId_CriadoEm",
                table: "Aparelhos",
                columns: new[] { "UsuarioId", "CriadoEm" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Aparelhos");
        }
    }
}
